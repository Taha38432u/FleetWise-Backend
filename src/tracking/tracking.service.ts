import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtUserPayload } from '../common/types/jwt-payload.type';

@Injectable()
export class TrackingService {
  constructor(private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma as any;
  }

  async saveLocation(payload: any, actorUserId?: string) {
    const organizationId = actorUserId
      ? await this.resolveOrganizationId(actorUserId)
      : undefined;
    const vehicle = await this.prisma.vehicle.findFirst({
      where: {
        id: payload.vehicleId,
        isDeleted: false,
        ...(organizationId !== undefined ? { organizationId } : {}),
      },
    });
    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    return this.db.gpsLog.create({
      data: {
        vehicleId: payload.vehicleId,
        latitude: payload.latitude,
        longitude: payload.longitude,
        speed: payload.speed ?? null,
        heading: payload.heading ?? null,
        timestamp: payload.timestamp ? new Date(payload.timestamp) : new Date(),
      },
    });
  }

  async saveLocationForUser(payload: any, user: JwtUserPayload) {
    if (user.role === 'DRIVER') {
      const driver = await this.prisma.driver.findFirst({
        where: { userId: user.id, isDeleted: false },
      });
      if (!driver) {
        throw new ForbiddenException('Driver profile not found');
      }

      const activeRoute = await this.db.route.findFirst({
        where: {
          driverId: driver.id,
          vehicleId: payload.vehicleId,
          status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
        },
      });
      if (!activeRoute) {
        throw new ForbiddenException('This vehicle is not assigned to your active route');
      }
    }

    return this.saveLocation(payload, user.id);
  }

  async getLatest(vehicleId: string, actorUserId?: string) {
    await this.assertVehicleInTenant(vehicleId, actorUserId);
    const record = await this.db.gpsLog.findFirst({
      where: { vehicleId },
      orderBy: { timestamp: 'desc' },
    });
    return record;
  }

  async getHistory(vehicleId: string, from?: string, to?: string, actorUserId?: string) {
    await this.assertVehicleInTenant(vehicleId, actorUserId);
    const where: any = { vehicleId };
    if (from || to) {
      where.timestamp = {};
      if (from) where.timestamp.gte = new Date(from);
      if (to) where.timestamp.lte = new Date(to);
    }
    return this.db.gpsLog.findMany({
      where,
      orderBy: { timestamp: 'asc' },
      take: 500,
    });
  }

  private async assertVehicleInTenant(vehicleId: string, actorUserId?: string) {
    const organizationId = actorUserId
      ? await this.resolveOrganizationId(actorUserId)
      : undefined;
    const vehicle = await this.prisma.vehicle.findFirst({
      where: {
        id: vehicleId,
        isDeleted: false,
        ...(organizationId !== undefined ? { organizationId } : {}),
      },
      select: { id: true },
    });
    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
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
