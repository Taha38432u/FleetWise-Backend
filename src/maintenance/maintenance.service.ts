import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { JwtUserPayload } from '../common/types/jwt-payload.type';

import type {
  AiPredictionResult,
  PredictiveMaintenanceTelemetryDto,
} from './dto/predictive-maintenance.dto';

@Injectable()
export class MaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private get db() {
    return this.prisma as any;
  }

  async create(payload: any, user?: JwtUserPayload) {
    const organizationId = user
      ? await this.resolveOrganizationId(user.id)
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

    if (payload.mechanicId) {
      const mechanic = await this.prisma.user.findFirst({
        where: {
          id: payload.mechanicId,
          role: 'MECHANIC',
          ...(organizationId !== undefined ? { organizationId } : {}),
        },
      });
      if (!mechanic) {
        throw new NotFoundException('Mechanic not found');
      }
    }

    const record = await this.db.maintenanceRecord.create({
      data: {
        vehicleId: payload.vehicleId,
        type: payload.type,
        description: payload.description,
        status: payload.status || 'PENDING',
        scheduledAt: new Date(payload.scheduledAt),
        completedAt: payload.completedAt ? new Date(payload.completedAt) : null,
        cost: payload.cost ?? null,
        mechanicId: payload.mechanicId || null,
        notes: payload.notes || null,
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
    });

    await this.notificationsService.notifyRoles(
      ['ADMIN', 'DISPATCHER', 'MECHANIC'],
      {
        title: 'Maintenance scheduled',
        message: `${record.vehicle.plate} has a ${record.type.toLowerCase()} task scheduled.`,
        type: 'MAINTENANCE_ALERT',
        actionUrl: '/maintenance',
      },
    );

    return record;
  }

  async findAll(params: any = {}, user?: JwtUserPayload) {
    const page = parseInt(params.page || '1', 10);
    const pageSize = parseInt(params.pageSize || '10', 10);
    const skip = (page - 1) * pageSize;
    const organizationId = user
      ? await this.resolveOrganizationId(user.id)
      : undefined;
    const where: any = {
      ...(organizationId !== undefined
        ? { vehicle: { organizationId } }
        : {}),
    };

    if (params.vehicleId) where.vehicleId = params.vehicleId;
    if (params.mechanicId) where.mechanicId = params.mechanicId;
    if (params.status) where.status = params.status;

    const [data, totalItems] = await Promise.all([
      this.db.maintenanceRecord.findMany({
        where,
        skip,
        take: pageSize,
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
        orderBy: { scheduledAt: 'asc' },
      }),
      this.db.maintenanceRecord.count({ where }),
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

  async findAllForUser(params: any = {}, user: JwtUserPayload) {
    if (user.role === 'MECHANIC') {
      return this.findAll({ ...params, mechanicId: user.id }, user);
    }
    return this.findAll(params, user);
  }

  async findOne(id: string, user?: JwtUserPayload) {
    const organizationId = user
      ? await this.resolveOrganizationId(user.id)
      : undefined;
    const record = await this.db.maintenanceRecord.findFirst({
      where: {
        id,
        ...(organizationId !== undefined
          ? { vehicle: { organizationId } }
          : {}),
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
    });

    if (!record) {
      throw new NotFoundException('Maintenance record not found');
    }

    return record;
  }

  async findOneForUser(id: string, user: JwtUserPayload) {
    const record = await this.findOne(id, user);
    if (user.role === 'MECHANIC' && record.mechanicId !== user.id) {
      throw new ForbiddenException('This maintenance record is not assigned to you');
    }
    return record;
  }

  async findByVehicle(vehicleId: string, user?: JwtUserPayload) {
    const organizationId = user
      ? await this.resolveOrganizationId(user.id)
      : undefined;
    await this.assertVehicleInTenant(vehicleId, organizationId);
    return this.db.maintenanceRecord.findMany({
      where: { vehicleId },
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
      orderBy: { scheduledAt: 'desc' },
    });
  }

  async findByVehicleForUser(vehicleId: string, user: JwtUserPayload) {
    if (user.role !== 'MECHANIC') {
      return this.findByVehicle(vehicleId, user);
    }
    return this.db.maintenanceRecord.findMany({
      where: { vehicleId, mechanicId: user.id },
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
      orderBy: { scheduledAt: 'desc' },
    });
  }

  async update(id: string, payload: any, user?: JwtUserPayload) {
    await this.findOne(id, user);

    const record = await this.db.maintenanceRecord.update({
      where: { id },
      data: {
        type: payload.type,
        description: payload.description,
        status: payload.status,
        scheduledAt: payload.scheduledAt ? new Date(payload.scheduledAt) : undefined,
        completedAt:
          typeof payload.completedAt !== 'undefined'
            ? payload.completedAt
              ? new Date(payload.completedAt)
              : null
            : undefined,
        cost: typeof payload.cost !== 'undefined' ? payload.cost : undefined,
        mechanicId:
          typeof payload.mechanicId !== 'undefined' ? payload.mechanicId : undefined,
        notes: typeof payload.notes !== 'undefined' ? payload.notes : undefined,
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
    });

    if (record.status === 'COMPLETED') {
      await this.notificationsService.notifyRoles(['ADMIN', 'DISPATCHER'], {
        title: 'Maintenance completed',
        message: `${record.vehicle.plate} maintenance has been completed.`,
        type: 'MAINTENANCE_ALERT',
        actionUrl: '/maintenance',
      });
    }

    return record;
  }

  async updateForUser(id: string, payload: any, user: JwtUserPayload) {
    const existing = await this.findOneForUser(id, user);
    const nextPayload =
      user.role === 'MECHANIC'
        ? {
            status: payload.status,
            completedAt: payload.completedAt,
            cost: payload.cost,
          }
        : payload;

    if (user.role === 'MECHANIC' && existing.mechanicId !== user.id) {
      throw new ForbiddenException('This maintenance record is not assigned to you');
    }

    return this.update(id, nextPayload, user);
  }

  async remove(id: string, user?: JwtUserPayload) {
    await this.findOne(id, user);
    await this.db.maintenanceRecord.delete({ where: { id } });
  }

  async predict(vehicleId: string, user?: JwtUserPayload) {
    const organizationId = user
      ? await this.resolveOrganizationId(user.id)
      : undefined;
    const vehicle = await this.prisma.vehicle.findFirst({
      where: {
        id: vehicleId,
        isDeleted: false,
        ...(organizationId !== undefined ? { organizationId } : {}),
      },
      include: {
        gpsLogs: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      },
    });
    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    const aiPayload = this.mapVehicleToAiPayload(vehicle);
    const prediction = this.normalizeAiPrediction({ failure_risk: 'low', predicted_failure_type: '', confidence_score: 0, risk_score: 0, suggested_action: '' } as any);

    const alert = await this.db.predictiveAlert.create({
      data: {
        vehicleId,
        predictedIssue: prediction.predicted_failure_type,
        riskScore: prediction.risk_score,
        confidence: prediction.confidence_score,
        riskLevel: prediction.failure_risk,
        maintenancePriority: prediction.maintenance_priority,
        suggestedAction: prediction.suggested_action,
        modelVersion: prediction.model_version,
        dataQuality: prediction.data_quality,
        message: this.buildPredictionMessage(vehicle.plate, prediction),
      },
      include: { vehicle: true },
    });

    if (['high', 'critical'].includes(prediction.failure_risk)) {
      await this.notificationsService.notifyRoles(['ADMIN', 'MECHANIC'], {
        title: 'Predictive maintenance alert',
        message: `${vehicle.plate} has ${prediction.failure_risk} AI risk at ${(prediction.risk_score * 100).toFixed(0)}% confidence ${(prediction.confidence_score * 100).toFixed(0)}%.`,
        type: 'PREDICTIVE_ALERT',
        actionUrl: '/maintenance',
      });
    }

    return alert;
  }

  async predictForUser(vehicleId: string, user: JwtUserPayload) {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can run AI predictions');
    }
    return this.predict(vehicleId, user);
  }

  async listPredictions(params: any = {}, user?: JwtUserPayload) {
    const organizationId = user
      ? await this.resolveOrganizationId(user.id)
      : undefined;
    const where: any = {
      ...(organizationId !== undefined
        ? { vehicle: { organizationId } }
        : {}),
    };
    if (params.vehicleId) {
      where.vehicleId = params.vehicleId;
    }
    if (params.includeActioned !== 'true') {
      where.isActioned = false;
    }
    if (params.riskLevel) {
      where.riskLevel = params.riskLevel;
    }

    const predictions = await this.db.predictiveAlert.findMany({
      where,
      include: { vehicle: true },
      orderBy: [{ riskScore: 'desc' }, { createdAt: 'desc' }],
      take: params.take ? Number(params.take) : 50,
    });

    return predictions.map((prediction: any) =>
      this.normalizeStoredPrediction(prediction),
    );
  }

  async listPredictionsForUser(user: JwtUserPayload, params: any = {}) {
    if (user.role !== 'MECHANIC') {
      return this.listPredictions(params, user);
    }

    const assignedVehicles = await this.db.maintenanceRecord.findMany({
      where: { mechanicId: user.id },
      select: { vehicleId: true },
      distinct: ['vehicleId'],
    });
    const vehicleIds = assignedVehicles.map((item: any) => item.vehicleId);
    if (!vehicleIds.length) {
      return [];
    }

    const predictions = await this.db.predictiveAlert.findMany({
      where: {
        ...(params.includeActioned === 'true' ? {} : { isActioned: false }),
        ...(params.riskLevel ? { riskLevel: params.riskLevel } : {}),
        vehicleId: params.vehicleId
          ? { in: vehicleIds.filter((id: string) => id === params.vehicleId) }
          : { in: vehicleIds },
      },
      include: { vehicle: true },
      orderBy: [{ riskScore: 'desc' }, { createdAt: 'desc' }],
      take: params.take ? Number(params.take) : 50,
    });

    return predictions.map((prediction: any) =>
      this.normalizeStoredPrediction(prediction),
    );
  }

  async aiHealth() {
  }

  async aiModelInfo() {
  }

  private mapVehicleToAiPayload(vehicle: any): PredictiveMaintenanceTelemetryDto {
    const vehicleType = this.mapVehicleTypeForAi(vehicle.type);
    const latestGps = vehicle.gpsLogs?.[0];
    return {
      vehicle_id: vehicle.id,
      vehicle_type: vehicleType,
      mileage_km: Number(vehicle.mileage || 0),
      fuel_efficiency_km_l: Number(vehicle.fuelEfficiency || 0),
      health_score: Number(vehicle.healthScore ?? 100),
      rotational_speed_rpm: latestGps?.speed
        ? Math.max(800, Math.min(3500, Number(latestGps.speed) * 32))
        : undefined,
      telemetry_source: latestGps?.speed
        ? 'fleetwise_vehicle_profile_with_latest_speed'
        : 'fleetwise_vehicle_profile',
    };
  }

  private mapVehicleTypeForAi(type: string): PredictiveMaintenanceTelemetryDto['vehicle_type'] {
    const normalized = String(type || '').toUpperCase();
    const typeMap: Record<string, PredictiveMaintenanceTelemetryDto['vehicle_type']> = {
      TRUCK: 'truck',
      VAN: 'van',
      CAR: 'car',
      BIKE: 'bike',
    };
    return typeMap[normalized] || 'machine';
  }

  private formatRiskLabel(risk: AiPredictionResult['failure_risk']) {
    return risk.toUpperCase();
  }

  private normalizeAiPrediction(prediction: AiPredictionResult): AiPredictionResult {
    if (prediction.failure_risk !== 'low') {
      return prediction;
    }

    return {
      ...prediction,
      predicted_failure_type: 'no_failure_expected',
      maintenance_priority: 'monitor',
      suggested_action:
        'Continue monitoring. AI found no actionable failure pattern in current vehicle data.',
    };
  }

  private normalizeStoredPrediction(prediction: any) {
    if (prediction.riskLevel !== 'low') {
      return prediction;
    }

    const plate = prediction.vehicle?.plate || 'Vehicle';
    return {
      ...prediction,
      predictedIssue: 'no_failure_expected',
      maintenancePriority: 'monitor',
      suggestedAction:
        'Continue monitoring. AI found no actionable failure pattern in current vehicle data.',
      message: `${plate} has low AI risk. No actionable failure pattern detected.`,
    };
  }

  private buildPredictionMessage(
    plate: string,
    prediction: AiPredictionResult,
  ) {
    if (prediction.failure_risk === 'low') {
      return `${plate} has low AI risk. No actionable failure pattern detected.`;
    }
    return `${plate} ${this.formatRiskLabel(prediction.failure_risk)} AI risk: ${prediction.suggested_action}`;
  }

  private async assertVehicleInTenant(
    vehicleId: string,
    organizationId?: string | null,
  ) {
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
