import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BillingService } from '../billing/billing.service';
import type { JwtUserPayload } from '../common/types/jwt-payload.type';

const ACTIVE_ROUTE_STATUSES = ['SCHEDULED', 'IN_PROGRESS'];

@Injectable()
export class RoutesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly billingService: BillingService,
  ) {}

  private get db() {
    return this.prisma as any;
  }

  async create(payload: any, createdById: string) {
    const organizationId = await this.resolveOrganizationId(createdById);
    await this.billingService.assertWithinLimit(createdById, 'activeRoutes');
    await this.assertVehicleAvailable(payload.vehicleId, undefined, organizationId);
    await this.assertDriverAvailable(payload.driverId, undefined, organizationId);

    const route = await this.db.route.create({
      data: {
        name: payload.name,
        startLocation: payload.startLocation,
        endLocation: payload.endLocation,
        scheduledAt: new Date(payload.scheduledAt),
        status: payload.status || 'SCHEDULED',
        driverId: payload.driverId || null,
        vehicleId: payload.vehicleId || null,
        createdById,
        estimatedDistance: payload.estimatedDistance ?? null,
        estimatedDurationMinutes: payload.estimatedDurationMinutes ?? null,
        notes: payload.notes ?? null,
      },
    });

    if (route.driverId) {
      const driver = await this.prisma.driver.findFirst({
        where: { id: route.driverId, isDeleted: false },
      });
      if (driver) {
        const driverUser = await this.prisma.user.findUnique({
          where: { id: driver.userId },
        });
        if (driverUser) {
          await this.notificationsService.create(driverUser.id, {
            title: 'New route assigned',
            message: `${route.name} has been assigned to you.`,
            type: 'ROUTE_ASSIGNED',
            actionUrl: '/dashboard',
          });
        }
      }
    }

    return this.findOne(route.id, createdById);
  }

  async findAll(query: any = {}, actorUserId?: string) {
    const page = parseInt(query.page || '1', 10);
    const pageSize = parseInt(query.pageSize || '10', 10);
    const skip = (page - 1) * pageSize;
    const organizationId = actorUserId
      ? await this.resolveOrganizationId(actorUserId)
      : undefined;
    const where: any = {
      ...(organizationId !== undefined
        ? { createdBy: { organizationId } }
        : {}),
    };

    if (query.status) where.status = query.status;
    if (query.driverId) where.driverId = query.driverId;
    if (query.vehicleId) where.vehicleId = query.vehicleId;

    const [data, totalItems] = await Promise.all([
      this.db.route.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          driver: { include: { user: true } },
          vehicle: {
            include: {
              gpsLogs: { orderBy: { timestamp: 'desc' }, take: 1 },
            },
          },
          createdBy: true,
        },
        orderBy: { scheduledAt: 'desc' },
      }),
      this.db.route.count({ where }),
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

  async findOne(id: string, actorUserId?: string) {
    const organizationId = actorUserId
      ? await this.resolveOrganizationId(actorUserId)
      : undefined;
    const route = await this.db.route.findFirst({
      where: {
        id,
        ...(organizationId !== undefined
          ? { createdBy: { organizationId } }
          : {}),
      },
      include: {
        driver: { include: { user: true } },
        vehicle: {
          include: {
            gpsLogs: { orderBy: { timestamp: 'desc' }, take: 1 },
          },
        },
        createdBy: true,
      },
    });

    if (!route) {
      throw new NotFoundException('Route not found');
    }

    return route;
  }

  async findOneForUser(id: string, user: JwtUserPayload) {
    const route = await this.findOne(id, user.id);
    if (user.role !== 'DRIVER') {
      return route;
    }

    const driver = await this.prisma.driver.findFirst({
      where: { userId: user.id, isDeleted: false },
    });

    if (!driver || route.driverId !== driver.id) {
      throw new ForbiddenException('This route is not assigned to you');
    }

    return route;
  }

  async getCurrentLocation(routeId: string, actorUserId?: string) {
    const route = await this.findOne(routeId, actorUserId);
    if (!route.vehicleId) {
      throw new BadRequestException('Route has no assigned vehicle');
    }

    return {
      routeId,
      vehicleId: route.vehicleId,
      location: route.vehicle?.gpsLogs?.[0] || null,
    };
  }

  async update(id: string, payload: any, actorUserId?: string) {
    const organizationId = actorUserId
      ? await this.resolveOrganizationId(actorUserId)
      : undefined;
    await this.findOne(id, actorUserId);
    if (typeof payload.vehicleId !== 'undefined') {
      await this.assertVehicleAvailable(payload.vehicleId, id, organizationId);
    }
    if (typeof payload.driverId !== 'undefined') {
      await this.assertDriverAvailable(payload.driverId, id, organizationId);
    }

    const route = await this.db.route.update({
      where: { id },
      data: {
        name: payload.name,
        startLocation: payload.startLocation,
        endLocation: payload.endLocation,
        scheduledAt: payload.scheduledAt ? new Date(payload.scheduledAt) : undefined,
        status: payload.status,
        driverId: typeof payload.driverId !== 'undefined' ? payload.driverId : undefined,
        vehicleId:
          typeof payload.vehicleId !== 'undefined' ? payload.vehicleId : undefined,
        actualStartAt: payload.actualStartAt ? new Date(payload.actualStartAt) : undefined,
        actualEndAt: payload.actualEndAt ? new Date(payload.actualEndAt) : undefined,
        estimatedDistance:
          typeof payload.estimatedDistance !== 'undefined'
            ? payload.estimatedDistance
            : undefined,
        actualDistance:
          typeof payload.actualDistance !== 'undefined'
            ? payload.actualDistance
            : undefined,
        estimatedDurationMinutes:
          typeof payload.estimatedDurationMinutes !== 'undefined'
            ? payload.estimatedDurationMinutes
            : undefined,
        actualDurationMinutes:
          typeof payload.actualDurationMinutes !== 'undefined'
            ? payload.actualDurationMinutes
            : undefined,
        notes: typeof payload.notes !== 'undefined' ? payload.notes : undefined,
      },
    });

    return this.findOne(route.id, actorUserId);
  }

  async updateDriverStatus(routeId: string, userId: string, status: string, payload: any = {}) {
    const driver = await this.prisma.driver.findFirst({
      where: { userId, isDeleted: false },
    });

    if (!driver) {
      throw new ForbiddenException('Driver profile not found');
    }

    const route = await this.db.route.findUnique({ where: { id: routeId } });
    if (!route) {
      throw new NotFoundException('Route not found');
    }

    if (route.driverId !== driver.id) {
      throw new ForbiddenException('This route is not assigned to you');
    }

    if (!['IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(status)) {
      throw new BadRequestException('Drivers can only start, complete, or cancel routes');
    }

    const currentStatus = String(route.status).toUpperCase();

    if (status === 'IN_PROGRESS' && currentStatus !== 'SCHEDULED') {
      throw new BadRequestException('Only scheduled routes can be started');
    }

    if (status === 'COMPLETED' && currentStatus !== 'IN_PROGRESS') {
      throw new BadRequestException('Only in-progress routes can be completed');
    }

    if (status === 'CANCELLED' && !['SCHEDULED', 'IN_PROGRESS'].includes(currentStatus)) {
      throw new BadRequestException('Only active routes can be cancelled');
    }

    const data: any = { status };
    if (status === 'IN_PROGRESS') data.actualStartAt = new Date();
    if (status === 'COMPLETED') data.actualEndAt = new Date();
    if (typeof payload.actualDistance !== 'undefined') {
      data.actualDistance = payload.actualDistance;
    }
    if (typeof payload.actualDurationMinutes !== 'undefined') {
      data.actualDurationMinutes = payload.actualDurationMinutes;
    }
    if (typeof payload.notes !== 'undefined') {
      data.notes = payload.notes;
    }

    const updated = await this.db.route.update({
      where: { id: routeId },
      data,
    });

    try {
      await this.notificationsService.notifyRoles(['ADMIN', 'DISPATCHER'], {
        title: 'Route status updated',
        message: `${updated.name} is now ${status.replace('_', ' ')}.`,
        type: 'SYSTEM',
        actionUrl: '/routes',
      });
    } catch (_error) {
      // Route state is the source of truth; notification delivery must not roll it back.
    }

    return this.findOne(routeId, userId);
  }

  async requestLocationUpdate(routeId: string, actorUserId?: string) {
    const route = await this.findOne(routeId, actorUserId);
    if (!route.driver?.user?.id) {
      throw new BadRequestException('Route has no assigned driver to request location from');
    }

    await this.notificationsService.create(route.driver.user.id, {
      title: 'Live location requested',
      message: `Dispatch requested a live location update for ${route.name}. Open My Routes and start GPS.`,
      type: 'SYSTEM',
      actionUrl: '/my-routes',
    });

    return { requested: true, routeId };
  }

  async remove(id: string, actorUserId?: string) {
    await this.findOne(id, actorUserId);
    await this.db.route.delete({ where: { id } });
  }

  async findByDriverId(driverId: string, page = 1, pageSize = 10, actorUserId?: string) {
    const skip = (page - 1) * pageSize;
    const organizationId = actorUserId
      ? await this.resolveOrganizationId(actorUserId)
      : undefined;
    const where = {
      driverId,
      ...(organizationId !== undefined
        ? { createdBy: { organizationId } }
        : {}),
    };
    const [data, totalItems] = await Promise.all([
      this.db.route.findMany({
        where,
        skip,
        take: pageSize,
        include: { vehicle: true },
        orderBy: { scheduledAt: 'desc' },
      }),
      this.db.route.count({ where }),
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

  async findByDriverUserId(userId: string, page = 1, pageSize = 10) {
    const driver = await this.prisma.driver.findFirst({
      where: { userId, isDeleted: false },
    });

    if (!driver) {
      return {
        data: [],
        meta: {
          totalItems: 0,
          totalPages: 0,
          currentPage: page,
          pageSize,
        },
      };
    }

    return this.findByDriverId(driver.id, page, pageSize);
  }

  private async assertVehicleAvailable(
    vehicleId?: string | null,
    currentRouteId?: string,
    organizationId?: string | null,
  ) {
    if (!vehicleId) return;

    const vehicle = await this.db.vehicle.findFirst({
      where: {
        id: vehicleId,
        isDeleted: false,
        ...(organizationId !== undefined ? { organizationId } : {}),
      },
    });
    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    const activeRoute = await this.db.route.findFirst({
      where: {
        vehicleId,
        status: { in: ACTIVE_ROUTE_STATUSES },
        ...(currentRouteId ? { id: { not: currentRouteId } } : {}),
      },
    });

    if (activeRoute) {
      throw new BadRequestException(
        'Vehicle is already assigned to an active route',
      );
    }
  }

  private async assertDriverAvailable(
    driverId?: string | null,
    currentRouteId?: string,
    organizationId?: string | null,
  ) {
    if (!driverId) return;

    const driver = await this.prisma.driver.findFirst({
      where: {
        id: driverId,
        isDeleted: false,
        ...(organizationId !== undefined
          ? { user: { organizationId } }
          : {}),
      },
    });
    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    const activeRoute = await this.db.route.findFirst({
      where: {
        driverId,
        status: { in: ACTIVE_ROUTE_STATUSES },
        ...(currentRouteId ? { id: { not: currentRouteId } } : {}),
      },
    });

    if (activeRoute) {
      throw new BadRequestException(
        'Driver is already assigned to an active route',
      );
    }
  }

  private async resolveOrganizationId(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    return user?.organizationId || null;
  }
}
