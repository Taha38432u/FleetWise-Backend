import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma as any;
  }

  private async resolveOrganizationId(userId?: string): Promise<string | null> {
    if (!userId) return null;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    return user?.organizationId || null;
  }

  private async paginate(model: string, query: any = {}, where: any = {}, orderBy: any = { createdAt: 'desc' }) {
    const page = parseInt(query.page || '1', 10);
    const pageSize = parseInt(query.limit || query.pageSize || '10', 10);
    const skip = (page - 1) * pageSize;

    const [data, totalItems] = await Promise.all([
      this.db[model].findMany({ where, skip, take: pageSize, orderBy }),
      this.db[model].count({ where }),
    ]);

    return {
      data,
      meta: {
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
        currentPage: page,
        pageSize,
      },
    };
  }

  private async recalculateBudgetUsage(organizationId?: string | null) {
    const budgets = await this.db.budget.findMany({
      where: organizationId !== undefined ? { organizationId } : {},
    });
    await Promise.all(
      budgets.map(async (budget: any) => {
        const where: any = {
          type: 'EXPENSE',
          occurredAt: {
            gte: budget.startDate,
            lte: budget.endDate,
          },
          organizationId: budget.organizationId,
        };

        if (budget.accountId) where.accountId = budget.accountId;
        if (budget.categoryId) where.categoryId = budget.categoryId;

        const result = await this.db.transaction.aggregate({
          _sum: { amount: true },
          where,
        });

        await this.db.budget.update({
          where: { id: budget.id },
          data: { used: Number(result?._sum?.amount || 0) },
        });
      }),
    );
  }

  private async materializeDueRecurringExpenses(organizationId?: string | null) {
    const now = new Date();
    const dueItems = await this.db.recurringExpense.findMany({
      where: {
        isActive: true,
        nextRunAt: { lte: now },
        ...(organizationId !== undefined ? { organizationId } : {}),
      },
    });

    for (const item of dueItems) {
      await this.createTransaction({
        type: 'EXPENSE',
        accountId: item.accountId,
        categoryId: item.categoryId,
        amount: item.amount,
        description: `Recurring expense: ${item.name}`,
        occurredAt: now.toISOString(),
        organizationId: item.organizationId,
      });

      const nextRunAt = new Date(item.nextRunAt);
      switch (item.interval) {
        case 'WEEKLY':
          nextRunAt.setDate(nextRunAt.getDate() + 7);
          break;
        case 'QUARTERLY':
          nextRunAt.setMonth(nextRunAt.getMonth() + 3);
          break;
        case 'YEARLY':
          nextRunAt.setFullYear(nextRunAt.getFullYear() + 1);
          break;
        default:
          nextRunAt.setMonth(nextRunAt.getMonth() + 1);
      }

      await this.db.recurringExpense.update({
        where: { id: item.id },
        data: { nextRunAt },
      });
    }
  }

  private buildDateWhere(query: any = {}) {
    if (!query.startDate && !query.endDate && !query.from && !query.to) {
      return undefined;
    }

    const where: any = {};
    const start = query.startDate || query.from;
    const end = query.endDate || query.to;
    if (start) where.gte = new Date(start);
    if (end) where.lte = new Date(end);
    return where;
  }

  private classifyCost(row: any) {
    const haystack = `${row.category?.name || ''} ${row.account?.type || ''} ${row.description || ''}`.toLowerCase();
    if (row.driverId && /(salary|payroll|compensation|driver pay)/.test(haystack)) {
      return 'driverSalaries';
    }
    if (/(fuel|diesel|petrol|gas)/.test(haystack)) return 'fuel';
    if (/(mechanic|labor|labour)/.test(haystack)) return 'mechanicLabor';
    if (row.maintenanceRecordId || /(maintenance|repair|service|parts)/.test(haystack)) {
      return 'maintenance';
    }
    if (row.routeId || /(route|toll|trip|dispatch)/.test(haystack)) return 'routeExpenses';
    if (/(insurance|lease|subscription|recurring)/.test(haystack)) return 'recurring';
    return 'operations';
  }

  async getCostSummary(query: any = {}, actorUserId?: string) {
    const organizationId = await this.resolveOrganizationId(actorUserId);
    await this.materializeDueRecurringExpenses(organizationId);
    const occurredAt = this.buildDateWhere(query);
    const where: any = { type: 'EXPENSE', organizationId };
    if (occurredAt) where.occurredAt = occurredAt;

    const [transactions, maintenanceRecords, recurringExpenses] = await Promise.all([
      this.db.transaction.findMany({
        where,
        include: {
          account: true,
          category: true,
        },
        orderBy: { occurredAt: 'desc' },
      }),
      this.db.maintenanceRecord.findMany({
        where: {
          ...(occurredAt ? { createdAt: occurredAt } : {}),
          vehicle: { organizationId },
        },
        include: {
          vehicle: true,
          mechanic: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
              role: true,
              status: true,
              organizationId: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.db.recurringExpense.findMany({
        where: { isActive: true, organizationId },
        include: { account: true, category: true },
      }),
    ]);

    const totals: Record<string, number> = {
      fuel: 0,
      maintenance: 0,
      driverSalaries: 0,
      mechanicLabor: 0,
      routeExpenses: 0,
      repair: 0,
      recurring: 0,
      operations: 0,
    };
    const byVehicle = new Map<string, any>();
    const byDriver = new Map<string, any>();

    for (const transaction of transactions) {
      const bucket = this.classifyCost(transaction);
      totals[bucket] += Number(transaction.amount || 0);

      if (transaction.vehicleId) {
        const existing = byVehicle.get(transaction.vehicleId) || {
          vehicleId: transaction.vehicleId,
          total: 0,
          fuel: 0,
          maintenance: 0,
          routeExpenses: 0,
          operations: 0,
        };
        existing.total += Number(transaction.amount || 0);
        existing[bucket] = Number(existing[bucket] || 0) + Number(transaction.amount || 0);
        byVehicle.set(transaction.vehicleId, existing);
      }

      if (transaction.driverId) {
        const existing = byDriver.get(transaction.driverId) || {
          driverId: transaction.driverId,
          total: 0,
          salary: 0,
          routeExpenses: 0,
        };
        existing.total += Number(transaction.amount || 0);
        if (bucket === 'driverSalaries') existing.salary += Number(transaction.amount || 0);
        if (bucket === 'routeExpenses') existing.routeExpenses += Number(transaction.amount || 0);
        byDriver.set(transaction.driverId, existing);
      }
    }

    const mechanicLaborRows = maintenanceRecords
      .filter((record: any) => record.mechanicId || Number(record.cost || 0) > 0)
      .map((record: any) => ({
        id: record.id,
        mechanicId: record.mechanicId,
        mechanicName: record.mechanic
          ? `${record.mechanic.firstName} ${record.mechanic.lastName}`
          : 'Unassigned mechanic',
        vehicleId: record.vehicleId,
        vehiclePlate: record.vehicle?.plate || record.vehicle?.registrationNumber || 'Unknown vehicle',
        type: record.type,
        status: record.status,
        amount: Number(record.cost || 0),
        completedAt: record.completedAt,
      }));

    const mechanicLaborFromMaintenance = mechanicLaborRows.reduce(
      (sum: number, row: any) => sum + Number(row.amount || 0),
      0,
    );
    totals.mechanicLabor += mechanicLaborFromMaintenance;
    totals.repair += maintenanceRecords
      .filter((record: any) => /repair/i.test(record.type || record.description || ''))
      .reduce((sum: number, record: any) => sum + Number(record.cost || 0), 0);
    totals.recurring += recurringExpenses.reduce(
      (sum: number, item: any) => sum + Number(item.amount || 0),
      0,
    );

    const total = Object.values(totals).reduce((sum, value) => sum + value, 0);

    return {
      totals,
      total,
      transactions,
      mechanicLaborRows,
      byVehicle: Array.from(byVehicle.values()),
      byDriver: Array.from(byDriver.values()),
      recurringExpenses,
    };
  }

  async getAccounts(query: any, actorUserId?: string) {
    const organizationId = await this.resolveOrganizationId(actorUserId);
    const where: any = { isArchived: false, organizationId };
    if (query.type) where.type = query.type;
    if (query.search) where.name = { contains: query.search, mode: 'insensitive' };
    return this.paginate('account', query, where);
  }

  async createAccount(payload: any, actorUserId?: string) {
    const organizationId = await this.resolveOrganizationId(actorUserId);
    return this.db.account.create({
      data: {
        name: payload.name,
        type: payload.type,
        balance: payload.balance ?? 0,
        description: payload.description ?? null,
        organizationId,
      },
    });
  }

  async updateAccount(id: string, payload: any, actorUserId?: string) {
    const organizationId = await this.resolveOrganizationId(actorUserId);
    await this.assertOwned('account', id, organizationId);
    return this.db.account.update({
      where: { id },
      data: {
        name: payload.name,
        type: payload.type,
        balance: typeof payload.balance !== 'undefined' ? payload.balance : undefined,
        description:
          typeof payload.description !== 'undefined' ? payload.description : undefined,
      },
    });
  }

  async deleteAccount(id: string, actorUserId?: string) {
    const organizationId = await this.resolveOrganizationId(actorUserId);
    await this.assertOwned('account', id, organizationId);
    await this.db.account.update({
      where: { id },
      data: { isArchived: true },
    });
  }

  async transferMoney(payload: any, actorUserId?: string) {
    const organizationId = await this.resolveOrganizationId(actorUserId);
    const fromAccount = await this.db.account.findUnique({
      where: { id: payload.fromAccountId },
    });
    const toAccount = await this.db.account.findUnique({
      where: { id: payload.toAccountId },
    });

    if (
      !fromAccount ||
      !toAccount ||
      fromAccount.organizationId !== organizationId ||
      toAccount.organizationId !== organizationId
    ) {
      throw new NotFoundException('Transfer account not found');
    }

    await this.db.$transaction([
      this.db.account.update({
        where: { id: payload.fromAccountId },
        data: { balance: { decrement: payload.amount } },
      }),
      this.db.account.update({
        where: { id: payload.toAccountId },
        data: { balance: { increment: payload.amount } },
      }),
      this.db.transaction.create({
        data: {
          type: 'TRANSFER',
          amount: payload.amount,
          description: payload.description || 'Fleet account transfer',
          occurredAt: new Date(),
          fromAccountId: payload.fromAccountId,
          toAccountId: payload.toAccountId,
          organizationId,
        },
      }),
    ]);

    return { ok: true };
  }

  async getCategories(query: any) {
    const where: any = {};
    if (query.search) where.name = { contains: query.search, mode: 'insensitive' };
    return this.paginate('category', query, where);
  }

  async createCategory(payload: any) {
    return this.db.category.create({
      data: {
        name: payload.name,
        description: payload.description ?? null,
        color: payload.color ?? '#3b82f6',
      },
    });
  }

  async updateCategory(id: string, payload: any) {
    return this.db.category.update({
      where: { id },
      data: payload,
    });
  }

  async deleteCategory(id: string) {
    await this.db.category.delete({ where: { id } });
  }

  async getTransactions(query: any, actorUserId?: string) {
    const organizationId = await this.resolveOrganizationId(actorUserId);
    await this.materializeDueRecurringExpenses(organizationId);

    const where: any = { organizationId };
    if (query.type) where.type = query.type;
    if (query.accountId) where.accountId = query.accountId;
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.search) where.description = { contains: query.search, mode: 'insensitive' };
    if (query.startDate || query.endDate) {
      where.occurredAt = {};
      if (query.startDate) where.occurredAt.gte = new Date(query.startDate);
      if (query.endDate) where.occurredAt.lte = new Date(query.endDate);
    }

    const page = parseInt(query.page || '1', 10);
    const pageSize = parseInt(query.limit || query.pageSize || '10', 10);
    const skip = (page - 1) * pageSize;

    const [data, totalItems] = await Promise.all([
      this.db.transaction.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          account: true,
          category: true,
          fromAccount: true,
          toAccount: true,
        },
        orderBy: { occurredAt: 'desc' },
      }),
      this.db.transaction.count({ where }),
    ]);

    return {
      data,
      meta: {
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
        currentPage: page,
        pageSize,
      },
    };
  }

  async getTransaction(id: string, actorUserId?: string) {
    const organizationId = await this.resolveOrganizationId(actorUserId);
    const transaction = await this.db.transaction.findFirst({
      where: { id, organizationId },
      include: {
        account: true,
        category: true,
        fromAccount: true,
        toAccount: true,
      },
    });
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }
    return transaction;
  }

  async createTransaction(payload: any, actorUserId?: string) {
    const organizationId =
      payload.organizationId ?? (await this.resolveOrganizationId(actorUserId));
    const data = await this.db.transaction.create({
      data: {
        type: payload.type,
        accountId: payload.accountId || null,
        categoryId: payload.categoryId || null,
        fromAccountId: payload.fromAccountId || null,
        toAccountId: payload.toAccountId || null,
        amount: payload.amount,
        description: payload.description,
        occurredAt: payload.occurredAt ? new Date(payload.occurredAt) : new Date(),
        vehicleId: payload.vehicleId || null,
        driverId: payload.driverId || null,
        routeId: payload.routeId || null,
        maintenanceRecordId: payload.maintenanceRecordId || null,
        organizationId,
      },
    });

    if (payload.type === 'EXPENSE' && payload.accountId) {
      await this.db.account.update({
        where: { id: payload.accountId },
        data: { balance: { decrement: payload.amount } },
      });
    }

    if (payload.type === 'INCOME' && payload.accountId) {
      await this.db.account.update({
        where: { id: payload.accountId },
        data: { balance: { increment: payload.amount } },
      });
    }

    await this.recalculateBudgetUsage(organizationId);
    return this.getTransaction(data.id, actorUserId);
  }

  async updateTransaction(id: string, payload: any, actorUserId?: string) {
    const organizationId = await this.resolveOrganizationId(actorUserId);
    await this.assertOwned('transaction', id, organizationId);
    await this.db.transaction.update({
      where: { id },
      data: {
        type: payload.type,
        accountId: payload.accountId || null,
        categoryId: payload.categoryId || null,
        amount: payload.amount,
        description: payload.description,
        occurredAt: payload.occurredAt ? new Date(payload.occurredAt) : undefined,
        vehicleId:
          typeof payload.vehicleId !== 'undefined' ? payload.vehicleId || null : undefined,
        driverId:
          typeof payload.driverId !== 'undefined' ? payload.driverId || null : undefined,
        routeId: typeof payload.routeId !== 'undefined' ? payload.routeId || null : undefined,
        maintenanceRecordId:
          typeof payload.maintenanceRecordId !== 'undefined'
            ? payload.maintenanceRecordId || null
            : undefined,
      },
    });

    await this.recalculateBudgetUsage(organizationId);
    return this.getTransaction(id, actorUserId);
  }

  async deleteTransaction(id: string, actorUserId?: string) {
    const organizationId = await this.resolveOrganizationId(actorUserId);
    await this.assertOwned('transaction', id, organizationId);
    await this.db.transaction.delete({ where: { id } });
    await this.recalculateBudgetUsage(organizationId);
  }

  async getBudgets(query: any, actorUserId?: string) {
    const organizationId = await this.resolveOrganizationId(actorUserId);
    const where: any = { organizationId };
    if (query.search) where.name = { contains: query.search, mode: 'insensitive' };
    const result = await this.paginate('budget', query, where);
    return result;
  }

  async getBudget(id: string, actorUserId?: string) {
    const organizationId = await this.resolveOrganizationId(actorUserId);
    const budget = await this.db.budget.findFirst({
      where: { id, organizationId },
      include: { account: true, category: true },
    });
    if (!budget) throw new NotFoundException('Budget not found');
    return {
      ...budget,
      remaining: Number(budget.amount - budget.used).toFixed(2),
      percentUsed: budget.amount ? (budget.used / budget.amount) * 100 : 0,
    };
  }

  async createBudget(payload: any, actorUserId?: string) {
    const organizationId = await this.resolveOrganizationId(actorUserId);
    const budget = await this.db.budget.create({
      data: {
        name: payload.name,
        amount: payload.amount,
        startDate: new Date(payload.startDate),
        endDate: new Date(payload.endDate),
        accountId: payload.accountId || null,
        categoryId: payload.categoryId || null,
        notes: payload.notes || null,
        organizationId,
      },
    });
    await this.recalculateBudgetUsage(organizationId);
    return this.getBudget(budget.id, actorUserId);
  }

  async updateBudget(id: string, payload: any, actorUserId?: string) {
    const organizationId = await this.resolveOrganizationId(actorUserId);
    await this.assertOwned('budget', id, organizationId);
    await this.db.budget.update({
      where: { id },
      data: {
        name: payload.name,
        amount: payload.amount,
        startDate: payload.startDate ? new Date(payload.startDate) : undefined,
        endDate: payload.endDate ? new Date(payload.endDate) : undefined,
        accountId: typeof payload.accountId !== 'undefined' ? payload.accountId : undefined,
        categoryId:
          typeof payload.categoryId !== 'undefined' ? payload.categoryId : undefined,
        notes: typeof payload.notes !== 'undefined' ? payload.notes : undefined,
      },
    });
    await this.recalculateBudgetUsage(organizationId);
    return this.getBudget(id, actorUserId);
  }

  async deleteBudget(id: string, actorUserId?: string) {
    const organizationId = await this.resolveOrganizationId(actorUserId);
    await this.assertOwned('budget', id, organizationId);
    await this.db.budget.delete({ where: { id } });
  }

  async getGoals(query: any, actorUserId?: string) {
    const organizationId = await this.resolveOrganizationId(actorUserId);
    const where: any = { organizationId };
    if (query.search) where.title = { contains: query.search, mode: 'insensitive' };
    return this.paginate('goal', query, where);
  }

  async getGoal(id: string, actorUserId?: string) {
    const organizationId = await this.resolveOrganizationId(actorUserId);
    const goal = await this.db.goal.findFirst({ where: { id, organizationId } });
    if (!goal) throw new NotFoundException('Goal not found');
    return goal;
  }

  async createGoal(payload: any, actorUserId?: string) {
    const organizationId = await this.resolveOrganizationId(actorUserId);
    return this.db.goal.create({
      data: {
        title: payload.title,
        metricType: payload.metricType,
        targetValue: payload.targetValue,
        currentValue: payload.currentValue ?? 0,
        dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
        status: payload.status || 'ON_TRACK',
        notes: payload.notes || null,
        organizationId,
      },
    });
  }

  async updateGoal(id: string, payload: any, actorUserId?: string) {
    const organizationId = await this.resolveOrganizationId(actorUserId);
    await this.assertOwned('goal', id, organizationId);
    return this.db.goal.update({
      where: { id },
      data: {
        title: payload.title,
        metricType: payload.metricType,
        targetValue: payload.targetValue,
        currentValue:
          typeof payload.currentValue !== 'undefined' ? payload.currentValue : undefined,
        dueDate:
          typeof payload.dueDate !== 'undefined'
            ? payload.dueDate
              ? new Date(payload.dueDate)
              : null
            : undefined,
        status: payload.status,
        notes: typeof payload.notes !== 'undefined' ? payload.notes : undefined,
      },
    });
  }

  async deleteGoal(id: string, actorUserId?: string) {
    const organizationId = await this.resolveOrganizationId(actorUserId);
    await this.assertOwned('goal', id, organizationId);
    await this.db.goal.delete({ where: { id } });
  }

  async getRecurring(query: any, actorUserId?: string) {
    const organizationId = await this.resolveOrganizationId(actorUserId);
    await this.materializeDueRecurringExpenses(organizationId);
    const where: any = { organizationId };
    if (query.search) where.name = { contains: query.search, mode: 'insensitive' };
    return this.paginate('recurringExpense', query, where);
  }

  async getRecurringOne(id: string, actorUserId?: string) {
    const organizationId = await this.resolveOrganizationId(actorUserId);
    const recurring = await this.db.recurringExpense.findFirst({
      where: { id, organizationId },
    });
    if (!recurring) throw new NotFoundException('Recurring expense not found');
    return recurring;
  }

  async createRecurring(payload: any, actorUserId?: string) {
    const organizationId = await this.resolveOrganizationId(actorUserId);
    return this.db.recurringExpense.create({
      data: {
        name: payload.name,
        amount: payload.amount,
        interval: payload.interval || 'MONTHLY',
        nextRunAt: payload.nextRunAt ? new Date(payload.nextRunAt) : new Date(),
        accountId: payload.accountId || null,
        categoryId: payload.categoryId || null,
        description: payload.description || null,
        isActive: typeof payload.isActive === 'boolean' ? payload.isActive : true,
        organizationId,
      },
    });
  }

  async updateRecurring(id: string, payload: any, actorUserId?: string) {
    const organizationId = await this.resolveOrganizationId(actorUserId);
    await this.assertOwned('recurringExpense', id, organizationId);
    return this.db.recurringExpense.update({
      where: { id },
      data: {
        name: payload.name,
        amount: payload.amount,
        interval: payload.interval,
        nextRunAt:
          typeof payload.nextRunAt !== 'undefined'
            ? new Date(payload.nextRunAt)
            : undefined,
        accountId: typeof payload.accountId !== 'undefined' ? payload.accountId : undefined,
        categoryId:
          typeof payload.categoryId !== 'undefined' ? payload.categoryId : undefined,
        description:
          typeof payload.description !== 'undefined' ? payload.description : undefined,
        isActive:
          typeof payload.isActive === 'boolean' ? payload.isActive : undefined,
      },
    });
  }

  async deleteRecurring(id: string, actorUserId?: string) {
    const organizationId = await this.resolveOrganizationId(actorUserId);
    await this.assertOwned('recurringExpense', id, organizationId);
    await this.db.recurringExpense.delete({ where: { id } });
  }

  private async assertOwned(model: string, id: string, organizationId: string | null) {
    const row = await this.db[model].findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!row) {
      throw new NotFoundException('Resource not found');
    }
  }
}
