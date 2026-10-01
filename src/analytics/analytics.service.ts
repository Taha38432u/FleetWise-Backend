import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtUserPayload } from '../common/types/jwt-payload.type';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma as any;
  }

  async getSummary(user: JwtUserPayload) {
    const actor = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { organizationId: true },
    });
    const organizationId = actor?.organizationId || null;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const next7Days = new Date(todayStart);
    next7Days.setDate(next7Days.getDate() + 7);
    const next30Days = new Date(todayStart);
    next30Days.setDate(next30Days.getDate() + 30);

    const [
      totalVehicles,
      activeVehicles,
      idleVehicles,
      maintenanceVehicles,
      totalDrivers,
      availableDrivers,
      onDutyDrivers,
      routesToday,
      unreadNotifications,
      criticalPredictions,
      monthlyExpenses,
      monthlyMaintenanceCosts,
      activeRecurringCosts,
      subscriptions,
      overdueMaintenance,
    ] = await Promise.all([
      this.prisma.vehicle.count({ where: { isDeleted: false, organizationId } }),
      this.prisma.vehicle.count({
        where: { isDeleted: false, status: 'ACTIVE' as any, organizationId },
      }),
      this.prisma.vehicle.count({
        where: { isDeleted: false, status: 'IDLE' as any, organizationId },
      }),
      this.prisma.vehicle.count({
        where: { isDeleted: false, status: 'IN_MAINTENANCE' as any, organizationId },
      }),
      this.prisma.driver.count({
        where: { isDeleted: false, user: { organizationId } },
      }),
      this.prisma.driver.count({
        where: {
          isDeleted: false,
          availabilityStatus: 'AVAILABLE' as any,
          user: { organizationId },
        },
      }),
      this.prisma.driver.count({
        where: {
          isDeleted: false,
          availabilityStatus: 'ON_DUTY' as any,
          user: { organizationId },
        },
      }),
      this.db.route.count({
        where: {
          scheduledAt: { gte: todayStart },
          status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
          createdBy: { organizationId },
        },
      }),
      this.db.notification.count({
        where: { userId: user.id, isRead: false },
      }),
      this.db.predictiveAlert.count({
        where: {
          isActioned: false,
          riskScore: { gte: 0.75 },
          vehicle: { organizationId },
        },
      }),
      this.db.transaction.aggregate({
        _sum: { amount: true },
        where: {
          type: 'EXPENSE',
          occurredAt: { gte: monthStart },
          organizationId,
        },
      }),
      this.db.maintenanceRecord.aggregate({
        _sum: { cost: true },
        where: {
          createdAt: { gte: monthStart },
          vehicle: { organizationId },
        },
      }),
      this.db.recurringExpense.aggregate({
        _sum: { amount: true },
        where: {
          isActive: true,
          organizationId,
        },
      }),
      this.db.subscription.findMany({
        where: { user: { organizationId } },
        select: { plan: true, status: true },
        take: 1,
      }),
      this.db.maintenanceRecord.count({
        where: {
          status: { in: ['PENDING', 'IN_PROGRESS'] },
          scheduledAt: { lt: now },
          vehicle: { organizationId },
        },
      }),
    ]);

    const upcomingPredictions = await this.db.predictiveAlert.findMany({
      where: {
        isActioned: false,
        createdAt: { gte: monthStart },
        vehicle: { organizationId },
      },
      include: { vehicle: true },
      orderBy: { riskScore: 'desc' },
      take: 5,
    });

    const upcomingMaintenance = await this.db.maintenanceRecord.findMany({
      where: {
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        vehicle: { organizationId },
      },
      include: {
        vehicle: true,
      },
      orderBy: { scheduledAt: 'asc' },
      take: 5,
    });

    const alerts = {
      critical: criticalPredictions,
      warning: overdueMaintenance,
      info: unreadNotifications,
    };

    const monthlyCostTotal =
      Number(monthlyExpenses?._sum?.amount || 0) +
      Number(monthlyMaintenanceCosts?._sum?.cost || 0) +
      Number(activeRecurringCosts?._sum?.amount || 0);

    const summary = {
      totalVehicles,
      activeVehicles,
      idleVehicles,
      maintenanceVehicles,
      totalDrivers,
      driversOnline: onDutyDrivers,
      driversOffline: Math.max(totalDrivers - onDutyDrivers, 0),
      availableDrivers,
      routesToday,
      subscriptionStatus:
        subscriptions[0]?.plan && subscriptions[0]?.status
          ? `${subscriptions[0].plan} ${subscriptions[0].status}`
          : 'FREE ACTIVE',
      monthlyCost: `$${monthlyCostTotal.toFixed(2)}`,
    };

    const aiPredictions = {
      next7Days: upcomingPredictions.filter((item: any) => item.riskScore >= 0.75)
        .length,
      next30Days: upcomingPredictions.length,
    };

    let driverContext: any = null;
    if (user.role === 'DRIVER') {
      const driver = await this.prisma.driver.findFirst({
        where: { userId: user.id, isDeleted: false },
      });

      if (driver) {
        const [myRoutes, myAttendance] = await Promise.all([
          this.db.route.findMany({
            where: { driverId: driver.id },
            orderBy: { scheduledAt: 'desc' },
            take: 5,
          }),
          this.prisma.attendanceRecord.findMany({
            where: { driverId: driver.id },
            orderBy: { date: 'desc' },
            take: 5,
          }),
        ]);

        driverContext = {
          driver,
          myRoutes,
          myAttendance,
        };
      }
    }

    if (user.role === 'MECHANIC') {
      const myQueue = await this.db.maintenanceRecord.findMany({
        where: {
          OR: [{ mechanicId: user.id }, { mechanicId: null }],
          status: { in: ['PENDING', 'IN_PROGRESS'] },
          vehicle: { organizationId },
        },
        include: { vehicle: true },
        orderBy: { scheduledAt: 'asc' },
        take: 10,
      });

      driverContext = {
        myQueue,
      };
    }

    return {
      role: user.role,
      summary,
      alerts,
      aiPredictions,
      upcomingMaintenance,
      upcomingPredictions,
      context: driverContext,
      windows: {
        next7Days,
        next30Days,
      },
    };
  }
}
