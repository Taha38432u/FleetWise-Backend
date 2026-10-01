import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from '../billing/billing.service';

@Injectable()
export class SuperAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billingService: BillingService,
  ) {}

  private get db() {
    return this.prisma as any;
  }

  async overview() {
    await this.billingService.syncPendingPayments();
    const [
      totalUsers,
      pendingPayments,
      activeSubscriptions,
      cancelledPlans,
      expiredPlans,
      activeTrials,
      expiredTrials,
      planDistribution,
      statusDistribution,
    ] = await Promise.all([
      this.db.user.count({
        where: {
          role: 'ADMIN',
          subscription: { isNot: null },
        },
      }),
      this.db.subscription.count({
        where: { paymentStatus: 'PENDING', user: { role: 'ADMIN' } },
      }),
      this.db.subscription.count({
        where: { status: 'ACTIVE', user: { role: 'ADMIN' } },
      }),
      this.db.subscription.count({
        where: {
          status: { in: ['CANCELED', 'CANCELLED'] },
          user: { role: 'ADMIN' },
        },
      }),
      this.db.subscription.count({
        where: { status: 'EXPIRED', user: { role: 'ADMIN' } },
      }),
      this.db.subscription.count({
        where: { status: 'TRIALING', user: { role: 'ADMIN' } },
      }),
      this.db.subscription.count({
        where: {
          status: 'TRIALING',
          trialEndAt: { lt: new Date() },
          user: { role: 'ADMIN' },
        },
      }),
      this.db.subscription.groupBy({
        by: ['plan'],
        where: { user: { role: 'ADMIN' } },
        _count: { plan: true },
      }),
      this.db.subscription.groupBy({
        by: ['status'],
        where: { user: { role: 'ADMIN' } },
        _count: { status: true },
      }),
    ]);

    return {
      totalUsers,
      paymentStatus: {
        pendingPayments,
        activeSubscriptions,
        cancelledPlans,
        expiredPlans,
        activeTrials,
        expiredTrials,
      },
      planDistribution,
      statusDistribution,
    };
  }

  async users(query: any = {}) {
    const page = Number(query.page || 1);
    const pageSize = Number(query.pageSize || 20);
    const where: any = {
      role: 'ADMIN',
      subscription: { isNot: null },
    };
    if (query.status) where.status = query.status;

    const [data, totalItems] = await Promise.all([
      this.db.user.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { subscription: true, organization: true },
      }),
      this.db.user.count({ where }),
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

  async subscriptions(query: any = {}) {
    await this.billingService.syncPendingPayments();
    const page = Number(query.page || 1);
    const pageSize = Number(query.pageSize || 20);
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.plan) where.plan = query.plan;

    const [data, totalItems] = await Promise.all([
      this.db.subscription.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { updatedAt: 'desc' },
        include: { user: true },
      }),
      this.db.subscription.count({ where }),
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

  async deactivateOrganization(adminUserId: string) {
    const account = await this.findAdminAccount(adminUserId);
    const organizationId = account.organizationId;

    await this.prisma.$transaction(async (tx) => {
      await tx.user.updateMany({
        where: organizationId ? { organizationId } : { id: adminUserId },
        data: { status: 'INACTIVE' },
      });
      await (tx as any).subscription.updateMany({
        where: { userId: adminUserId },
        data: {
          status: 'CANCELED',
          paymentStatus: 'NONE',
          pendingPlan: null,
          paymentUrl: null,
          cancelAtPeriodEnd: false,
        },
      });
    });

    return { adminUserId, organizationId, deactivated: true };
  }

  async resetOrganization(adminUserId: string) {
    const account = await this.findAdminAccount(adminUserId);
    const organizationId = account.organizationId;
    const userWhere = organizationId ? { organizationId } : { id: adminUserId };
    const vehicleWhere = organizationId
      ? { organizationId }
      : { organizationId: null };

    await this.prisma.$transaction(async (tx) => {
      await (tx as any).transaction.deleteMany({
        where: { organizationId: organizationId || null },
      });
      await (tx as any).budget.deleteMany({
        where: { organizationId: organizationId || null },
      });
      await (tx as any).goal.deleteMany({
        where: { organizationId: organizationId || null },
      });
      await (tx as any).recurringExpense.deleteMany({
        where: { organizationId: organizationId || null },
      });
      await (tx as any).account.deleteMany({
        where: { organizationId: organizationId || null },
      });

      await (tx as any).route.deleteMany({
        where: { createdBy: userWhere },
      });
      await (tx as any).maintenanceRecord.deleteMany({
        where: { vehicle: vehicleWhere },
      });
      await (tx as any).predictiveAlert.deleteMany({
        where: { vehicle: vehicleWhere },
      });
      await (tx as any).gpsLog.deleteMany({
        where: { vehicle: vehicleWhere },
      });
      await (tx as any).attendanceRecord.deleteMany({
        where: { driver: { user: userWhere } },
      });
      await (tx as any).drivingRecord.deleteMany({
        where: { driver: { user: userWhere } },
      });
      await (tx as any).vehicle.deleteMany({ where: vehicleWhere });
      await (tx as any).driver.deleteMany({
        where: { user: userWhere },
      });

      await (tx as any).notification.deleteMany({
        where: { user: userWhere },
      });
      await (tx as any).passwordResetToken.deleteMany({
        where: { user: userWhere },
      });
      await (tx as any).refreshToken.deleteMany({
        where: { user: userWhere },
      });
      await tx.user.deleteMany({
        where: {
          ...userWhere,
          id: { not: adminUserId },
        },
      });
      await tx.user.update({
        where: { id: adminUserId },
        data: { status: 'ACTIVE' },
      });
    });

    return { adminUserId, organizationId, reset: true };
  }

  private async findAdminAccount(adminUserId: string) {
    const account = await this.prisma.user.findFirst({
      where: {
        id: adminUserId,
        role: 'ADMIN',
        subscription: { isNot: null },
      },
      select: { id: true, organizationId: true },
    });

    if (!account) {
      throw new NotFoundException('Admin organization not found');
    }

    return account;
  }
}
