import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import { CreateDriverWithUserDto } from './dto/create-driver-with-user.dto';
import { UpdateDriverWithUserDto } from './dto/update-driver-with-user.dto';
import {
  DriverResponseDto,
  DriverDetailResponseDto,
  DriverWithUserResponseDto,
  UserResponseDto,
} from './dto/driver-response.dto';
import { CreateDrivingRecordDto } from './dto/create-driving-record.dto';
import { isDemoEmail } from '../common/utils/demo-account';

@Injectable()
export class DriverService {
  constructor(private prisma: PrismaService) {}

  async create(
    userId: string,
    createDriverDto: CreateDriverDto,
    actorUserId?: string,
  ): Promise<DriverResponseDto> {
    const organizationId = actorUserId
      ? await this.resolveOrganizationId(actorUserId)
      : undefined;
    // Verify user exists and has DRIVER role
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        ...(organizationId !== undefined ? { organizationId } : {}),
      },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    if (user.role !== 'DRIVER') {
      throw new BadRequestException(
        'User must have DRIVER role to create driver profile',
      );
    }

    // Check if driver already exists for this user (include soft-deleted when checking)
    const existingDriverRows: any = await this.prisma.$queryRaw`
      SELECT id FROM drivers WHERE "userId" = ${userId} LIMIT 1
    `;
    const existingDriver = existingDriverRows && existingDriverRows[0] ? existingDriverRows[0] : null;
    if (existingDriver) {
      throw new BadRequestException(
        'Driver profile already exists for this user',
      );
    }

    const driver = await this.prisma.driver.create({
      data: {
        userId,
        licenseNumber: createDriverDto.licenseNumber,
        licenseExpiry: new Date(createDriverDto.licenseExpiry),
        licenseStatus: this.mapLicenseStatus('Pending Verification'),
        yearsOfExperience: createDriverDto.yearsOfExperience,
        emergencyContact: createDriverDto.emergencyContact,
        emergencyContactPhone: createDriverDto.emergencyContactPhone,
        availabilityStatus: this.mapAvailabilityStatus(
          createDriverDto.availabilityStatus || 'Available',
        ),
        documentVerified: createDriverDto.documentVerified || false,
        backgroundCheckDone: createDriverDto.backgroundCheckDone || false,
      },
      include: { user: true },
    });

    return this.mapToResponseDto(driver);
  }

  async createWithUser(
    createDriverWithUserDto: CreateDriverWithUserDto,
    actorUserId?: string,
  ): Promise<DriverWithUserResponseDto> {
    if (isDemoEmail(createDriverWithUserDto.user.email)) {
      throw new BadRequestException(
        'Emails on @demo.com are reserved for read-only demos and cannot be created.',
      );
    }

    const organizationId = actorUserId
      ? await this.resolveOrganizationId(actorUserId)
      : null;
    // Check if user with email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: createDriverWithUserDto.user.email },
    });
    if (existingUser) {
      throw new BadRequestException(
        `User with email ${createDriverWithUserDto.user.email} already exists`,
      );
    }

    // Check if driver with license number already exists (include soft-deleted when checking)
    const existingDriverRows: any = await this.prisma.$queryRaw`
      SELECT id FROM drivers WHERE "licenseNumber" = ${createDriverWithUserDto.licenseNumber} LIMIT 1
    `;
    if (existingDriverRows && existingDriverRows[0]) {
      throw new BadRequestException(
        `Driver with license number ${createDriverWithUserDto.licenseNumber} already exists`,
      );
    }

    // Hash default password
    const hashedPassword = await bcrypt.hash('12345678', 10);

    // Create user and driver in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create user with auto-verified fields
      const user = await tx.user.create({
        data: {
          email: createDriverWithUserDto.user.email,
          password: hashedPassword,
          firstName: createDriverWithUserDto.user.firstName,
          lastName: createDriverWithUserDto.user.lastName,
          phone: createDriverWithUserDto.user.phone,
          role: 'DRIVER',
          status: 'ACTIVE',
          emailVerified: true,
          emailVerifiedAt: new Date(),
          organizationId,
        },
      });

      // Create driver with the new userId
      const driver = await tx.driver.create({
        data: {
          userId: user.id,
          licenseNumber: createDriverWithUserDto.licenseNumber,
          licenseExpiry: new Date(createDriverWithUserDto.licenseExpiry),
          licenseStatus: 'VALID',
          yearsOfExperience: createDriverWithUserDto.yearsOfExperience,
          emergencyContact: createDriverWithUserDto.emergencyContact,
          emergencyContactPhone: createDriverWithUserDto.emergencyContactPhone,
          availabilityStatus: this.mapAvailabilityStatus(
            createDriverWithUserDto.availabilityStatus || 'Available',
          ),
          documentVerified: createDriverWithUserDto.documentVerified || true,
          backgroundCheckDone: createDriverWithUserDto.backgroundCheckDone || true,
        },
        include: { user: true },
      });

      return { user, driver };
    });

    return {
      user: this.mapToUserResponseDto(result.user),
      driver: this.mapToResponseDto(result.driver),
    };
  }

  async findAll(
    page: number = 1,
    pageSize: number = 10,
    licenseStatus?: string,
    availabilityStatus?: string,
    search?: string,
    isVehicleAssigned?: string,
    actorUserId?: string,
  ): Promise<{ data: DriverResponseDto[]; meta: any }> {
    const skip = (page - 1) * pageSize;
    const organizationId = actorUserId
      ? await this.resolveOrganizationId(actorUserId)
      : undefined;

    const where: any = {
      isDeleted: false,
      ...(organizationId !== undefined ? { user: { organizationId } } : {}),
    };

    if (licenseStatus) {
      where.licenseStatus = this.mapLicenseStatus(licenseStatus);
    }

    if (availabilityStatus) {
      where.availabilityStatus = this.mapAvailabilityStatus(availabilityStatus);
    }

    if (search) {
      where.OR = [
        { licenseNumber: { contains: search, mode: 'insensitive' } },
        { emergencyContact: { contains: search, mode: 'insensitive' } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { user: { firstName: { contains: search, mode: 'insensitive' } } },
        { user: { lastName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    // If `isVehicleAssigned` query param is present, filter to drivers without assigned vehicle
    // Note: per requirement, this filter is disabled by default and only enabled when the param is provided
    if (typeof isVehicleAssigned !== 'undefined') {
      where.isVehicleAssigned = false;
    }

    const [drivers, totalItems] = await Promise.all([
      this.prisma.driver.findMany({
        where,
        skip,
        take: pageSize,
        include: { user: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.driver.count({ where }),
    ]);

    const totalPages = Math.ceil(totalItems / pageSize);

    return {
      data: drivers.map((d) => this.mapToResponseDto(d)),
      meta: {
        totalItems,
        totalPages,
        currentPage: page,
        pageSize,
      },
    };
  }

  async findOne(id: string, actorUserId?: string): Promise<DriverDetailResponseDto> {
    const organizationId = actorUserId
      ? await this.resolveOrganizationId(actorUserId)
      : undefined;
    const driver = await this.prisma.driver.findFirst({
      where: {
        id,
        isDeleted: false,
        ...(organizationId !== undefined ? { user: { organizationId } } : {}),
      },
      include: {
        user: true,
        assignedVehicles: {
          where: { isDeleted: false },
          select: { id: true, plate: true, type: true, model: true },
        },
      },
    });

    if (!driver) {
      throw new NotFoundException(`Driver with ID ${id} not found`);
    }

    return this.mapToDetailResponseDto(driver);
  }

  async findByUserId(
    userId: string,
    actorUserId?: string,
  ): Promise<DriverDetailResponseDto> {
    const organizationId = actorUserId
      ? await this.resolveOrganizationId(actorUserId)
      : undefined;
    const driver = await this.prisma.driver.findFirst({
      where: {
        userId,
        isDeleted: false,
        ...(organizationId !== undefined ? { user: { organizationId } } : {}),
      },
      include: {
        user: true,
        assignedVehicles: {
          where: { isDeleted: false },
          select: { id: true, plate: true, type: true, model: true },
        },
      },
    });

    if (!driver) {
      throw new NotFoundException(`Driver not found for user ID ${userId}`);
    }

    return this.mapToDetailResponseDto(driver);
  }

  async update(
    id: string,
    updateDriverDto: UpdateDriverDto,
    actorUserId?: string,
  ): Promise<DriverResponseDto> {
    await this.findOne(id, actorUserId); // Verify exists

    const updateData: any = {};

    if (updateDriverDto.licenseNumber !== undefined)
      updateData.licenseNumber = updateDriverDto.licenseNumber;
    if (updateDriverDto.licenseExpiry !== undefined)
      updateData.licenseExpiry = new Date(updateDriverDto.licenseExpiry);
    if (updateDriverDto.licenseStatus !== undefined)
      updateData.licenseStatus = this.mapLicenseStatus(
        updateDriverDto.licenseStatus,
      );
    if (updateDriverDto.yearsOfExperience !== undefined)
      updateData.yearsOfExperience = updateDriverDto.yearsOfExperience;
    if (updateDriverDto.emergencyContact !== undefined)
      updateData.emergencyContact = updateDriverDto.emergencyContact;
    if (updateDriverDto.emergencyContactPhone !== undefined)
      updateData.emergencyContactPhone = updateDriverDto.emergencyContactPhone;
    if (updateDriverDto.availabilityStatus !== undefined)
      updateData.availabilityStatus = this.mapAvailabilityStatus(
        updateDriverDto.availabilityStatus,
      );
    if (updateDriverDto.documentVerified !== undefined)
      updateData.documentVerified = updateDriverDto.documentVerified;
    if (updateDriverDto.backgroundCheckDone !== undefined) {
      updateData.backgroundCheckDone = updateDriverDto.backgroundCheckDone;
      if (updateDriverDto.backgroundCheckDone) {
        updateData.backgroundCheckDate = new Date();
      }
    }

    const driver = await this.prisma.driver.update({
      where: { id },
      data: updateData,
      include: { user: true },
    });

    return this.mapToResponseDto(driver);
  }

  async updateWithUser(
    id: string,
    updateDriverWithUserDto: UpdateDriverWithUserDto,
    actorUserId?: string,
  ): Promise<DriverWithUserResponseDto> {
    // Verify driver exists
    const existingDriver = await this.findOne(id, actorUserId);

    // Check if email already exists (if being updated)
    if (updateDriverWithUserDto.user?.email) {
      const userWithEmail = await this.prisma.user.findUnique({
        where: { email: updateDriverWithUserDto.user.email },
      });
      if (userWithEmail && userWithEmail.id !== existingDriver.userId) {
        throw new BadRequestException(
          `User with email ${updateDriverWithUserDto.user.email} already exists`,
        );
      }
    }

    // Check if license number already exists (if being updated)
    if (updateDriverWithUserDto.licenseNumber) {
      const driverWithLicenseRows: any = await this.prisma.$queryRaw`
        SELECT id FROM drivers WHERE "licenseNumber" = ${updateDriverWithUserDto.licenseNumber} LIMIT 1
      `;
      const driverWithLicense = driverWithLicenseRows && driverWithLicenseRows[0] ? driverWithLicenseRows[0] : null;
      if (driverWithLicense && driverWithLicense.id !== id) {
        throw new BadRequestException(
          `Driver with license number ${updateDriverWithUserDto.licenseNumber} already exists`,
        );
      }
    }

    // Update both User and Driver in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Update User if user data provided
      let updatedUser: any = null;
      if (updateDriverWithUserDto.user) {
        const userUpdateData: any = {};
        if (updateDriverWithUserDto.user.email !== undefined)
          userUpdateData.email = updateDriverWithUserDto.user.email;
        if (updateDriverWithUserDto.user.firstName !== undefined)
          userUpdateData.firstName = updateDriverWithUserDto.user.firstName;
        if (updateDriverWithUserDto.user.lastName !== undefined)
          userUpdateData.lastName = updateDriverWithUserDto.user.lastName;
        if (updateDriverWithUserDto.user.phone !== undefined)
          userUpdateData.phone = updateDriverWithUserDto.user.phone;

        updatedUser = await tx.user.update({
          where: { id: existingDriver.userId },
          data: userUpdateData,
        });
      }

      // Update Driver
      const driverUpdateData: any = {};
      if (updateDriverWithUserDto.licenseNumber !== undefined)
        driverUpdateData.licenseNumber = updateDriverWithUserDto.licenseNumber;
      if (updateDriverWithUserDto.licenseExpiry !== undefined)
        driverUpdateData.licenseExpiry = new Date(
          updateDriverWithUserDto.licenseExpiry,
        );
      if (updateDriverWithUserDto.licenseStatus !== undefined)
        driverUpdateData.licenseStatus = this.mapLicenseStatus(
          updateDriverWithUserDto.licenseStatus,
        );
      if (updateDriverWithUserDto.yearsOfExperience !== undefined)
        driverUpdateData.yearsOfExperience =
          updateDriverWithUserDto.yearsOfExperience;
      if (updateDriverWithUserDto.emergencyContact !== undefined)
        driverUpdateData.emergencyContact =
          updateDriverWithUserDto.emergencyContact;
      if (updateDriverWithUserDto.emergencyContactPhone !== undefined)
        driverUpdateData.emergencyContactPhone =
          updateDriverWithUserDto.emergencyContactPhone;
      if (updateDriverWithUserDto.availabilityStatus !== undefined)
        driverUpdateData.availabilityStatus = this.mapAvailabilityStatus(
          updateDriverWithUserDto.availabilityStatus,
        );
      if (updateDriverWithUserDto.documentVerified !== undefined)
        driverUpdateData.documentVerified =
          updateDriverWithUserDto.documentVerified;
      if (updateDriverWithUserDto.backgroundCheckDone !== undefined) {
        driverUpdateData.backgroundCheckDone =
          updateDriverWithUserDto.backgroundCheckDone;
        if (updateDriverWithUserDto.backgroundCheckDone) {
          driverUpdateData.backgroundCheckDate = new Date();
        }
      }

      const updatedDriver = await tx.driver.update({
        where: { id },
        data: driverUpdateData,
        include: { user: true },
      });

      return { updatedUser, updatedDriver };
    });

    const userToReturn = result.updatedUser || result.updatedDriver.user;
    return {
      user: this.mapToUserResponseDto(userToReturn),
      driver: this.mapToResponseDto(result.updatedDriver),
    };
  }

  async delete(id: string, actorUserId?: string): Promise<void> {
    await this.findOne(id, actorUserId); // Verify exists
    await (this.prisma.driver as any).update({
      where: { id },
      data: { isDeleted: true },
    });
  }

  async assignVehicle(
    driverId: string,
    vehicleId: string,
    actorUserId?: string,
  ): Promise<DriverDetailResponseDto> {
    const organizationId = actorUserId
      ? await this.resolveOrganizationId(actorUserId)
      : undefined;
    await this.findOne(driverId, actorUserId);

    const vehicle = await this.prisma.vehicle.findFirst({
      where: {
        id: vehicleId,
        isDeleted: false,
        ...(organizationId !== undefined ? { organizationId } : {}),
      },
    });
    if (!vehicle) {
      throw new NotFoundException(`Vehicle with ID ${vehicleId} not found`);
    }

    await this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: { assignedDriverId: driverId },
    });

    // Also update driver record to track assigned vehicle
    await (this.prisma.driver as any).update({
      where: { id: driverId },
      data: { isVehicleAssigned: true, vehicleAssignedId: vehicleId },
    });

    return this.findOne(driverId, actorUserId);
  }

  async unassignVehicle(vehicleId: string, actorUserId?: string): Promise<void> {
    const organizationId = actorUserId
      ? await this.resolveOrganizationId(actorUserId)
      : undefined;
    const vehicle = await this.prisma.vehicle.findFirst({
      where: {
        id: vehicleId,
        isDeleted: false,
        ...(organizationId !== undefined ? { organizationId } : {}),
      },
    });
    if (!vehicle) {
      throw new NotFoundException(`Vehicle with ID ${vehicleId} not found`);
    }

    await this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: { assignedDriverId: null },
    });
    // Clear driver vehicle assignment if present
    // Find previous driver (if any) who had this vehicle assigned
    const prevDriverRows: any = await this.prisma.$queryRaw`
      SELECT id FROM drivers WHERE "vehicleAssignedId" = ${vehicleId} LIMIT 1
    `;
    const prevDriver = prevDriverRows && prevDriverRows[0] ? prevDriverRows[0] : null;
    if (prevDriver) {
      await (this.prisma.driver as any).update({
        where: { id: prevDriver.id },
        data: { isVehicleAssigned: false, vehicleAssignedId: null },
      });
    }
  }

  async addDrivingRecord(
    driverId: string,
    createRecordDto: CreateDrivingRecordDto,
    actorUserId?: string,
  ): Promise<any> {
    await this.findOne(driverId, actorUserId);

    const record = await this.prisma.drivingRecord.create({
      data: {
        driverId,
        startLocation: createRecordDto.startLocation,
        endLocation: createRecordDto.endLocation,
        startTime: new Date(createRecordDto.startTime),
        endTime: createRecordDto.endTime
          ? new Date(createRecordDto.endTime)
          : null,
        distance: createRecordDto.distance,
        fuelUsed: createRecordDto.fuelUsed,
        notes: createRecordDto.notes,
      },
    });

    // Update driver stats
    await this.prisma.driver.update({
      where: { id: driverId },
      data: {
        totalRides: { increment: 1 },
        totalDistance: { increment: createRecordDto.distance },
        lastWorkingDate: new Date(),
      },
    });

    return {
      id: record.id,
      driverId: record.driverId,
      startLocation: record.startLocation,
      endLocation: record.endLocation,
      startTime: record.startTime.toISOString(),
      endTime: record.endTime?.toISOString() || null,
      distance: record.distance,
      fuelUsed: record.fuelUsed,
      notes: record.notes,
      createdAt: record.createdAt,
    };
  }

  async getDrivingHistory(
    driverId: string,
    page: number = 1,
    pageSize: number = 10,
    actorUserId?: string,
  ): Promise<any> {
    await this.findOne(driverId, actorUserId);

    const skip = (page - 1) * pageSize;

    const [records, total] = await Promise.all([
      this.prisma.drivingRecord.findMany({
        where: { driverId },
        skip,
        take: pageSize,
        orderBy: { startTime: 'desc' },
      }),
      this.prisma.drivingRecord.count({ where: { driverId } }),
    ]);

    return {
      data: records.map((r) => ({
        id: r.id,
        startLocation: r.startLocation,
        endLocation: r.endLocation,
        startTime: r.startTime.toISOString(),
        endTime: r.endTime?.toISOString() || null,
        distance: r.distance,
        fuelUsed: r.fuelUsed,
        notes: r.notes,
        createdAt: r.createdAt,
      })),
      meta: {
        totalItems: total,
        totalPages: Math.ceil(total / pageSize),
        currentPage: page,
        pageSize,
      },
    };
  }

  private async resolveOrganizationId(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    return user?.organizationId || null;
  }

  private mapToResponseDto(driver: any): DriverResponseDto {
    return {
      id: driver.id,
      userId: driver.userId,
      user: driver.user ? this.mapToUserResponseDto(driver.user) : undefined,
      licenseNumber: driver.licenseNumber,
      licenseExpiry: driver.licenseExpiry.toISOString(),
      licenseStatus: this.mapPrismaLicenseStatusToString(driver.licenseStatus),
      yearsOfExperience: driver.yearsOfExperience,
      emergencyContact: driver.emergencyContact,
      emergencyContactPhone: driver.emergencyContactPhone,
      availabilityStatus: this.mapPrismaAvailabilityStatusToString(
        driver.availabilityStatus,
      ),
      documentVerified: driver.documentVerified,
      backgroundCheckDone: driver.backgroundCheckDone,
      backgroundCheckDate: driver.backgroundCheckDate?.toISOString() || null,
      updatedAt: driver.updatedAt.toISOString(),
    };
  }

  private mapToDetailResponseDto(driver: any): DriverDetailResponseDto {
    return {
      ...this.mapToResponseDto(driver),
      user: {
        id: driver.user.id,
        email: driver.user.email,
        firstName: driver.user.firstName,
        lastName: driver.user.lastName,
        phone: driver.user.phone,
        role: driver.user.role,
        status: driver.user.status,
      },
      assignedVehicles: driver.assignedVehicles || [],
    } as DriverDetailResponseDto;
  }

  private mapLicenseStatus(
    status: string,
  ): 'VALID' | 'EXPIRED' | 'SUSPENDED' | 'PENDING_VERIFICATION' {
    const statusMap: {
      [key: string]: 'VALID' | 'EXPIRED' | 'SUSPENDED' | 'PENDING_VERIFICATION';
    } = {
      Valid: 'VALID',
      Expired: 'EXPIRED',
      Suspended: 'SUSPENDED',
      'Pending Verification': 'PENDING_VERIFICATION',
    };
    return statusMap[status] || 'PENDING_VERIFICATION';
  }

  private mapAvailabilityStatus(
    status: string,
  ): 'AVAILABLE' | 'ON_DUTY' | 'OFF_DUTY' | 'ON_LEAVE' {
    const statusMap: {
      [key: string]: 'AVAILABLE' | 'ON_DUTY' | 'OFF_DUTY' | 'ON_LEAVE';
    } = {
      Available: 'AVAILABLE',
      'On Duty': 'ON_DUTY',
      'Off Duty': 'OFF_DUTY',
      'On Leave': 'ON_LEAVE',
    };
    return statusMap[status] || 'AVAILABLE';
  }

  private mapPrismaLicenseStatusToString(status: string): string {
    const statusMap: { [key: string]: string } = {
      VALID: 'Valid',
      EXPIRED: 'Expired',
      SUSPENDED: 'Suspended',
      PENDING_VERIFICATION: 'Pending Verification',
    };
    return statusMap[status] || status;
  }

  private mapPrismaAvailabilityStatusToString(status: string): string {
    const statusMap: { [key: string]: string } = {
      AVAILABLE: 'Available',
      ON_DUTY: 'On Duty',
      OFF_DUTY: 'Off Duty',
      ON_LEAVE: 'On Leave',
    };
    return statusMap[status] || status;
  }

  private mapToUserResponseDto(user: any): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      role: user.role,
      status: user.status,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
