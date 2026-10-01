import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FinanceService } from '../finance/finance.service';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financeService: FinanceService,
  ) {}

  private get db() {
    return this.prisma as any;
  }

  private buildDateWhere(from?: string, to?: string) {
    if (!from && !to) {
      return undefined;
    }

    const where: any = {};
    if (from) where.gte = new Date(from);
    if (to) where.lte = new Date(to);
    return where;
  }

  async fleetSummary(from?: string, to?: string) {
    const vehicleCounts = await Promise.all([
      this.prisma.vehicle.count({ where: { isDeleted: false } }),
      this.prisma.vehicle.count({
        where: { isDeleted: false, status: 'ACTIVE' as any },
      }),
      this.prisma.vehicle.count({
        where: { isDeleted: false, status: 'IDLE' as any },
      }),
      this.prisma.vehicle.count({
        where: { isDeleted: false, status: 'IN_MAINTENANCE' as any },
      }),
    ]);

    const maintenanceRecords = await this.db.maintenanceRecord.findMany({
      where: {
        createdAt: this.buildDateWhere(from, to),
      },
      include: { vehicle: true },
      orderBy: { createdAt: 'desc' },
    });

    return {
      totalVehicles: vehicleCounts[0],
      activeVehicles: vehicleCounts[1],
      idleVehicles: vehicleCounts[2],
      maintenanceVehicles: vehicleCounts[3],
      maintenanceRecords,
    };
  }

  async driverPerformance(from?: string, to?: string) {
    const records = await this.prisma.drivingRecord.findMany({
      where: {
        startTime: this.buildDateWhere(from, to),
      },
      include: {
        driver: {
          include: {
            user: true,
          },
        },
      },
    });

    const summary = new Map<string, any>();
    records.forEach((record) => {
      const key = record.driverId;
      const existing = summary.get(key) || {
        driverId: record.driverId,
        driverName: `${record.driver.user.firstName} ${record.driver.user.lastName}`,
        trips: 0,
        distance: 0,
        fuelUsed: 0,
      };
      existing.trips += 1;
      existing.distance += record.distance;
      existing.fuelUsed += record.fuelUsed;
      summary.set(key, existing);
    });

    return Array.from(summary.values());
  }

  async maintenanceHistory(from?: string, to?: string) {
    return this.db.maintenanceRecord.findMany({
      where: {
        createdAt: this.buildDateWhere(from, to),
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
    });
  }

  async fuelConsumption(from?: string, to?: string) {
    const records = await this.prisma.drivingRecord.findMany({
      where: {
        startTime: this.buildDateWhere(from, to),
      },
      include: {
        driver: {
          include: {
            assignedVehicles: true,
          },
        },
      },
    });

    return records.map((record) => ({
      driverId: record.driverId,
      fuelUsed: record.fuelUsed,
      distance: record.distance,
      fuelEfficiency:
        record.fuelUsed > 0 ? Number((record.distance / record.fuelUsed).toFixed(2)) : 0,
      startTime: record.startTime,
      endTime: record.endTime,
    }));
  }

  async routeEfficiency(from?: string, to?: string) {
    return this.db.route.findMany({
      where: {
        scheduledAt: this.buildDateWhere(from, to),
      },
      include: {
        driver: { include: { user: true } },
        vehicle: true,
      },
      orderBy: { scheduledAt: 'desc' },
    });
  }

  async budgetVsActual(from?: string, to?: string) {
    const budgets = await this.db.budget.findMany({
      include: {
        account: true,
        category: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const dateWhere = this.buildDateWhere(from, to);
    return Promise.all(
      budgets.map(async (budget: any) => {
        const where: any = {
          type: 'EXPENSE',
          occurredAt: dateWhere || {
            gte: budget.startDate,
            lte: budget.endDate,
          },
        };

        if (budget.accountId) where.accountId = budget.accountId;
        if (budget.categoryId) where.categoryId = budget.categoryId;

        const result = await this.db.transaction.aggregate({
          _sum: { amount: true },
          where,
        });

        return {
          ...budget,
          actual: Number(result?._sum?.amount || 0),
          remaining: Number(budget.amount - Number(result?._sum?.amount || 0)),
        };
      }),
    );
  }

  async operationsDashboard(from?: string, to?: string) {
    const dateWhere = this.buildDateWhere(from, to);
    const [
      costs,
      routes,
      subscriptions,
      drivers,
      attendance,
      vehicles,
      maintenance,
    ] = await Promise.all([
      this.financeService.getCostSummary({ from, to }),
      this.db.route.groupBy({
        by: ['status'],
        where: {
          scheduledAt: dateWhere,
        },
        _count: { status: true },
      }),
      this.db.subscription.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      this.prisma.driver.findMany({
        where: { isDeleted: false },
        include: { user: true, routes: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.db.attendanceRecord.findMany({
        where: {
          date: dateWhere,
        },
        include: { driver: { include: { user: true } } },
        orderBy: { date: 'desc' },
        take: 30,
      }),
      this.prisma.vehicle.findMany({
        where: { isDeleted: false },
        include: { routes: true, maintenanceRecords: true },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      this.db.maintenanceRecord.findMany({
        where: {
          createdAt: dateWhere,
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
        take: 30,
      }),
    ]);

    const routeStatus = routes.reduce((acc: Record<string, number>, row: any) => {
      acc[row.status] = row._count.status;
      return acc;
    }, {});
    const subscriptionStatus = subscriptions.reduce(
      (acc: Record<string, number>, row: any) => {
        acc[row.status] = row._count.status;
        return acc;
      },
      {},
    );
    const now = new Date();
    const trialing = await this.db.subscription.count({ where: { status: 'TRIALING' } });
    const expiredTrials = await this.db.subscription.count({
      where: { status: 'TRIALING', trialEndAt: { lt: now } },
    });

    return {
      summary: {
        totalCost: costs.total,
        fuelCost: costs.totals.fuel,
        driverSalaryCost: costs.totals.driverSalaries,
        mechanicLaborCost: costs.totals.mechanicLabor,
        routeExpenseCost: costs.totals.routeExpenses,
        activeRoutes: routeStatus.IN_PROGRESS || 0,
        completedRoutes: routeStatus.COMPLETED || 0,
        abandonedRoutes: routeStatus.CANCELLED || 0,
        trialing,
        expiredTrials,
      },
      costs,
      routeStatus,
      subscriptionStatus,
      driverSalaries: costs.byDriver,
      mechanicLabor: costs.mechanicLaborRows,
      maintenance,
      vehicleUtilization: vehicles.map((vehicle: any) => ({
        vehicleId: vehicle.id,
        plate: vehicle.plate || vehicle.registrationNumber,
        status: vehicle.status,
        routeCount: vehicle.routes?.length || 0,
        maintenanceCount: vehicle.maintenanceRecords?.length || 0,
      })),
      driverActivity: drivers.map((driver) => ({
        driverId: driver.id,
        name: `${driver.user.firstName} ${driver.user.lastName}`,
        status: driver.availabilityStatus,
        routeCount: driver.routes?.length || 0,
      })),
      attendance,
    };
  }
}
