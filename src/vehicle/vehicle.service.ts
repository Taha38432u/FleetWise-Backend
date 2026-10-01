import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { VehicleStatus, VehicleType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from '../billing/billing.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { VehicleResponseDto } from './dto/vehicle-response.dto';

@Injectable()
export class VehicleService {
  constructor(
    private prisma: PrismaService,
    private readonly billingService: BillingService,
  ) {}

  async create(
    createVehicleDto: CreateVehicleDto,
    actorUserId?: string,
  ): Promise<VehicleResponseDto> {
    const organizationId = actorUserId
      ? await this.resolveOrganizationId(actorUserId)
      : null;

    if (actorUserId) {
      await this.billingService.assertWithinLimit(actorUserId, 'vehicles');
    }

    const assignedDriverId = createVehicleDto.assignedDriverId || null;

    if (assignedDriverId) {
      await this.ensureAssignableDriver(assignedDriverId, undefined, organizationId);
    }

    const vehicle = await this.prisma.$transaction(async (tx) => {
      const created = await tx.vehicle.create({
        data: {
          plate: createVehicleDto.plate,
          type: this.mapVehicleType(createVehicleDto.type),
          model: createVehicleDto.model,
          year: createVehicleDto.year,
          status: this.mapVehicleStatus(createVehicleDto.status || 'Active'),
          mileage: createVehicleDto.mileage || 0,
          fuelEfficiency: createVehicleDto.fuelEfficiency || 0,
          lastService: createVehicleDto.lastService
            ? new Date(createVehicleDto.lastService)
            : null,
          nextPredictedMaintenance: createVehicleDto.nextPredictedMaintenance
            ? new Date(createVehicleDto.nextPredictedMaintenance)
            : null,
          insuranceExpiry: createVehicleDto.insuranceExpiry
            ? new Date(createVehicleDto.insuranceExpiry)
            : null,
          fitnessExpiry: createVehicleDto.fitnessExpiry
            ? new Date(createVehicleDto.fitnessExpiry)
            : null,
          healthScore: createVehicleDto.healthScore || 100,
          assignedDriverId,
          organizationId,
        },
        include: { assignedDriver: { include: { user: true } } },
      });

      if (assignedDriverId) {
        await tx.driver.update({
          where: { id: assignedDriverId },
          data: { isVehicleAssigned: true, vehicleAssignedId: created.id },
        });
      }

      return created;
    });

    return this.mapToResponseDto(vehicle);
  }

  async findAll(
    page: number = 1,
    pageSize: number = 10,
    status?: string,
    type?: string,
    search?: string,
    actorUserId?: string,
  ): Promise<{ data: VehicleResponseDto[]; meta: any }> {
    const skip = (page - 1) * pageSize;
    const organizationId = actorUserId
      ? await this.resolveOrganizationId(actorUserId)
      : null;

    const where: any = { isDeleted: false, organizationId };

    // Filter by status
    if (status) {
      where.status = this.mapVehicleStatus(status);
    }

    // Filter by type
    if (type) {
      where.type = this.mapVehicleType(type);
    }

    // Global search - search in plate, model, and assignedDriver
    if (search) {
      where.OR = [
        { plate: { contains: search, mode: 'insensitive' } },
        { model: { contains: search, mode: 'insensitive' } },
        { assignedDriverId: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [vehicles, totalItems] = await Promise.all([
      this.prisma.vehicle.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          assignedDriver: { include: { user: true } },
          predictiveAlerts: {
            where: { isActioned: false },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      }),
      this.prisma.vehicle.count({ where }),
    ]);

    const totalPages = Math.ceil(totalItems / pageSize);

    return {
      data: vehicles.map((v) => this.mapToResponseDto(v)),
      meta: {
        totalItems,
        totalPages,
        currentPage: page,
        pageSize,
      },
    };
  }

  async findOne(id: string, actorUserId?: string): Promise<VehicleResponseDto> {
    const organizationId = actorUserId
      ? await this.resolveOrganizationId(actorUserId)
      : undefined;
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id, isDeleted: false, ...(organizationId !== undefined ? { organizationId } : {}) },
      include: {
        assignedDriver: { include: { user: true } },
        routes: {
          orderBy: { scheduledAt: 'desc' },
          take: 5,
          include: { driver: { include: { user: true } } },
        },
        maintenanceRecords: {
          orderBy: { scheduledAt: 'desc' },
          take: 3,
        },
        gpsLogs: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
        predictiveAlerts: {
          where: { isActioned: false },
          orderBy: { createdAt: 'desc' },
          take: 3,
        },
      },
    });

    if (!vehicle) {
      throw new NotFoundException(`Vehicle with ID ${id} not found`);
    }

    return this.mapToResponseDto(vehicle);
  }

  async update(
    id: string,
    updateVehicleDto: UpdateVehicleDto,
    actorUserId?: string,
  ): Promise<VehicleResponseDto> {
    const organizationId = actorUserId
      ? await this.resolveOrganizationId(actorUserId)
      : undefined;
    const existingVehicle = await this.prisma.vehicle.findFirst({
      where: { id, isDeleted: false, ...(organizationId !== undefined ? { organizationId } : {}) },
    });

    if (!existingVehicle) {
      throw new NotFoundException(`Vehicle with ID ${id} not found`);
    }

    const updateData: any = {};

    if (updateVehicleDto.plate !== undefined)
      updateData.plate = updateVehicleDto.plate;
    if (updateVehicleDto.type !== undefined)
      updateData.type = this.mapVehicleType(updateVehicleDto.type);
    if (updateVehicleDto.model !== undefined)
      updateData.model = updateVehicleDto.model;
    if (updateVehicleDto.year !== undefined)
      updateData.year = updateVehicleDto.year;
    if (updateVehicleDto.status !== undefined)
      updateData.status = this.mapVehicleStatus(updateVehicleDto.status);
    if (updateVehicleDto.mileage !== undefined)
      updateData.mileage = updateVehicleDto.mileage;
    if (updateVehicleDto.fuelEfficiency !== undefined)
      updateData.fuelEfficiency = updateVehicleDto.fuelEfficiency;
    if (updateVehicleDto.lastService !== undefined)
      updateData.lastService = updateVehicleDto.lastService
        ? new Date(updateVehicleDto.lastService)
        : null;
    if (updateVehicleDto.nextPredictedMaintenance !== undefined)
      updateData.nextPredictedMaintenance =
        updateVehicleDto.nextPredictedMaintenance
          ? new Date(updateVehicleDto.nextPredictedMaintenance)
          : null;
    if (updateVehicleDto.assignedDriverId !== undefined) {
      updateData.assignedDriverId = updateVehicleDto.assignedDriverId || null;
      if (updateData.assignedDriverId) {
        await this.ensureAssignableDriver(
          updateData.assignedDriverId,
          id,
          organizationId ?? null,
        );
      }
    }
    if (updateVehicleDto.insuranceExpiry !== undefined)
      updateData.insuranceExpiry = updateVehicleDto.insuranceExpiry
        ? new Date(updateVehicleDto.insuranceExpiry)
        : null;
    if (updateVehicleDto.fitnessExpiry !== undefined)
      updateData.fitnessExpiry = updateVehicleDto.fitnessExpiry
        ? new Date(updateVehicleDto.fitnessExpiry)
        : null;
    if (updateVehicleDto.healthScore !== undefined)
      updateData.healthScore = updateVehicleDto.healthScore;

    const updatedVehicle = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.vehicle.update({
        where: { id },
        data: updateData,
        include: { assignedDriver: { include: { user: true } } },
      });

      if (updateVehicleDto.assignedDriverId !== undefined) {
        if (existingVehicle.assignedDriverId) {
          await tx.driver.updateMany({
            where: {
              id: existingVehicle.assignedDriverId,
              vehicleAssignedId: id,
            },
            data: { isVehicleAssigned: false, vehicleAssignedId: null },
          });
        }

        if (updated.assignedDriverId) {
          await tx.driver.update({
            where: { id: updated.assignedDriverId },
            data: { isVehicleAssigned: true, vehicleAssignedId: id },
          });
        }
      }

      return updated;
    });

    return this.mapToResponseDto(updatedVehicle);
  }

  async delete(id: string, actorUserId?: string): Promise<void> {
    const organizationId = actorUserId
      ? await this.resolveOrganizationId(actorUserId)
      : undefined;
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id, isDeleted: false, ...(organizationId !== undefined ? { organizationId } : {}) },
    });

    if (!vehicle) {
      throw new NotFoundException(`Vehicle with ID ${id} not found`);
    }

    await this.prisma.$transaction(async (tx) => {
      await (tx.vehicle as any).update({
        where: { id },
        data: { isDeleted: true, assignedDriverId: null },
      });

      if (vehicle.assignedDriverId) {
        await tx.driver.updateMany({
          where: { id: vehicle.assignedDriverId, vehicleAssignedId: id },
          data: { isVehicleAssigned: false, vehicleAssignedId: null },
        });
      }
    });
  }

  private async ensureAssignableDriver(
    driverId: string,
    currentVehicleId?: string,
    organizationId?: string | null,
  ): Promise<void> {
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
      throw new NotFoundException(`Driver with ID ${driverId} not found`);
    }

    if (
      driver.isVehicleAssigned &&
      driver.vehicleAssignedId &&
      driver.vehicleAssignedId !== currentVehicleId
    ) {
      throw new BadRequestException(`Driver with ID ${driverId} is already assigned`);
    }
  }

  private async resolveOrganizationId(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    return user?.organizationId || null;
  }

  private mapToResponseDto(vehicle: any): VehicleResponseDto {
    return {
      id: vehicle.id,
      plate: vehicle.plate,
      type: this.mapPrismaTypeToString(vehicle.type),
      model: vehicle.model,
      year: vehicle.year,
      status: this.mapPrismaStatusToString(vehicle.status),
      mileage: vehicle.mileage,
      fuelEfficiency: vehicle.fuelEfficiency,
      lastService: vehicle.lastService?.toISOString() || null,
      nextPredictedMaintenance:
        vehicle.nextPredictedMaintenance?.toISOString() || null,
      assignedDriverId: vehicle.assignedDriverId,
      assignedDriver:
        vehicle.assignedDriver && vehicle.assignedDriver.user
          ? `${vehicle.assignedDriver.user.firstName} ${vehicle.assignedDriver.user.lastName}`
          : null,
      activeRoute:
        vehicle.routes?.find((route: any) =>
          ['SCHEDULED', 'IN_PROGRESS'].includes(route.status),
        ) || null,
      lastRoute: vehicle.routes?.[0] || null,
      latestLocation: vehicle.gpsLogs?.[0] || null,
      openMaintenanceCount:
        vehicle.maintenanceRecords?.filter((record: any) =>
          ['PENDING', 'IN_PROGRESS'].includes(record.status),
        ).length || 0,
      predictiveAlerts: vehicle.predictiveAlerts || [],
      insuranceExpiry: vehicle.insuranceExpiry?.toISOString() || null,
      fitnessExpiry: vehicle.fitnessExpiry?.toISOString() || null,
      healthScore: vehicle.healthScore,
      createdAt: vehicle.createdAt,
      updatedAt: vehicle.updatedAt,
    };
  }

  private mapVehicleType(type: string): VehicleType {
    const typeMap: { [key: string]: VehicleType } = {
      Truck: VehicleType.TRUCK,
      Van: VehicleType.VAN,
      Car: VehicleType.CAR,
      Bike: VehicleType.BIKE,
    };
    return typeMap[type] || (type as VehicleType);
  }

  private mapVehicleStatus(status: string): VehicleStatus {
    const statusMap: { [key: string]: VehicleStatus } = {
      Active: VehicleStatus.ACTIVE,
      Idle: VehicleStatus.IDLE,
      'In Maintenance': VehicleStatus.IN_MAINTENANCE,
      Decommissioned: VehicleStatus.DECOMMISSIONED,
    };
    return statusMap[status] || (status as VehicleStatus);
  }

  private mapPrismaTypeToString(type: string): string {
    const typeMap: { [key: string]: string } = {
      TRUCK: 'Truck',
      VAN: 'Van',
      CAR: 'Car',
      BIKE: 'Bike',
    };
    return typeMap[type] || type;
  }

  private mapPrismaStatusToString(status: string): string {
    const statusMap: { [key: string]: string } = {
      ACTIVE: 'Active',
      IDLE: 'Idle',
      IN_MAINTENANCE: 'In Maintenance',
      DECOMMISSIONED: 'Decommissioned',
    };
    return statusMap[status] || status;
  }
}
