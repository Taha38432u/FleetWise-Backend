import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '../common/enums/user-role.enum';
import { UserStatus } from '../common/enums/user-status.enum';
import { BillingService } from '../billing/billing.service';
import { isDemoEmail } from '../common/utils/demo-account';

const MANAGED_ROLES = [
  UserRole.ADMIN,
  UserRole.DISPATCHER,
  UserRole.DRIVER,
  UserRole.MECHANIC,
];

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billingService: BillingService,
  ) {}

  async findAll(query: any = {}, actorUserId?: string) {
    const page = parseInt(query.page || '1', 10);
    const pageSize = parseInt(query.pageSize || query.limit || '10', 10);
    const skip = (page - 1) * pageSize;
    const actor = actorUserId
      ? await this.prisma.user.findUnique({
          where: { id: actorUserId },
          select: { organizationId: true },
        })
      : null;
    const where: any = {
      role: { in: MANAGED_ROLES },
      organizationId: actor?.organizationId || null,
      ...(actorUserId ? { id: { not: actorUserId } } : {}),
    };

    if (query.role) {
      if (!MANAGED_ROLES.includes(query.role)) {
        throw new BadRequestException('Invalid user role');
      }
      where.role = query.role;
    }

    if (query.search) {
      where.OR = [
        { email: { contains: query.search, mode: 'insensitive' } },
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [users, totalItems] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: this.staffSelect(),
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      meta: {
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
        currentPage: page,
        pageSize,
      },
    };
  }

  async create(payload: any, actorUserId?: string) {
    this.assertManagedRole(payload.role);

    if (isDemoEmail(payload.email)) {
      throw new BadRequestException(
        'Emails on @demo.com are reserved for read-only demos and cannot be created.',
      );
    }

    const actor = actorUserId
      ? await this.prisma.user.findUnique({
          where: { id: actorUserId },
          select: { organizationId: true },
        })
      : null;
    if (actorUserId) {
      await this.billingService.assertWithinLimit(
        actorUserId,
        payload.role === UserRole.DRIVER
          ? 'drivers'
          : payload.role === UserRole.DISPATCHER
            ? 'dispatchers'
            : 'staff',
      );
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: payload.email },
    });

    if (existing) {
      throw new ConflictException('User with this email already exists');
    }

    const password = payload.password || 'FleetWise123';
    if (password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }

    if (payload.role === UserRole.DRIVER) {
      this.assertDriverProfile(payload);

      const existingDriver = await this.prisma.driver.findUnique({
        where: { licenseNumber: payload.licenseNumber },
      });
      if (existingDriver) {
        throw new ConflictException('Driver with this license already exists');
      }

      return this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: payload.email,
            password: await bcrypt.hash(password, 10),
            firstName: payload.firstName,
            lastName: payload.lastName,
            phone: payload.phone || null,
            role: UserRole.DRIVER,
            status: payload.status || UserStatus.ACTIVE,
            emailVerified: true,
            emailVerifiedAt: new Date(),
            organizationId: actor?.organizationId || null,
          },
        });

        await tx.driver.create({
          data: {
            userId: user.id,
            licenseNumber: payload.licenseNumber,
            licenseExpiry: new Date(payload.licenseExpiry),
            licenseStatus: 'VALID',
            yearsOfExperience: Number(payload.yearsOfExperience || 0),
            emergencyContact: payload.emergencyContact,
            emergencyContactPhone: payload.emergencyContactPhone,
            availabilityStatus: 'AVAILABLE',
            documentVerified: true,
            backgroundCheckDone: true,
            backgroundCheckDate: new Date(),
          },
        });

        return tx.user.findUniqueOrThrow({
          where: { id: user.id },
          select: this.staffSelect(),
        });
      });
    }

    return this.prisma.user.create({
      data: {
        email: payload.email,
        password: await bcrypt.hash(password, 10),
        firstName: payload.firstName,
        lastName: payload.lastName,
        phone: payload.phone || null,
        role: payload.role,
        status: payload.status || UserStatus.ACTIVE,
        emailVerified: true,
        emailVerifiedAt: new Date(),
        organizationId: actor?.organizationId || null,
      },
      select: this.staffSelect(),
    });
  }

  async update(id: string, payload: any, actorUserId?: string) {
    const existing = await this.findOne(id, actorUserId);
    this.assertManagedRole(existing.role as UserRole);

    if (payload.role) {
      this.assertManagedRole(payload.role);
    }

    const data: any = {};
    for (const key of [
      'email',
      'firstName',
      'lastName',
      'phone',
      'role',
      'status',
    ]) {
      if (typeof payload[key] !== 'undefined') data[key] = payload[key];
    }

    if (payload.password) {
      if (payload.password.length < 8) {
        throw new BadRequestException('Password must be at least 8 characters');
      }
      data.password = await bcrypt.hash(payload.password, 10);
    }

    const user = await this.prisma.user.update({
      where: { id },
      data,
      select: this.staffSelect(),
    });

    if (user.role === UserRole.DRIVER && payload.driver) {
      const driverData: any = {};
      for (const key of [
        'licenseNumber',
        'emergencyContact',
        'emergencyContactPhone',
      ]) {
        if (typeof payload.driver[key] !== 'undefined') {
          driverData[key] = payload.driver[key];
        }
      }
      if (typeof payload.driver.licenseExpiry !== 'undefined') {
        driverData.licenseExpiry = new Date(payload.driver.licenseExpiry);
      }
      if (typeof payload.driver.yearsOfExperience !== 'undefined') {
        driverData.yearsOfExperience = Number(payload.driver.yearsOfExperience);
      }
      if (Object.keys(driverData).length) {
        await this.prisma.driver.upsert({
          where: { userId: id },
          update: driverData,
          create: {
            userId: id,
            licenseNumber: driverData.licenseNumber,
            licenseExpiry: driverData.licenseExpiry,
            yearsOfExperience: Number(driverData.yearsOfExperience || 0),
            emergencyContact: driverData.emergencyContact,
            emergencyContactPhone: driverData.emergencyContactPhone,
            licenseStatus: 'VALID',
            availabilityStatus: 'AVAILABLE',
            documentVerified: true,
            backgroundCheckDone: true,
            backgroundCheckDate: new Date(),
          },
        });
      }
      return this.findOne(id, actorUserId);
    }

    return user;
  }

  async findOne(id: string, actorUserId?: string) {
    const actor = actorUserId
      ? await this.prisma.user.findUnique({
          where: { id: actorUserId },
          select: { organizationId: true },
        })
      : null;
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        organizationId: actor?.organizationId || null,
      },
      select: this.staffSelect(),
    });

    if (!user || !MANAGED_ROLES.includes(user.role as UserRole)) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async deactivate(id: string, actorUserId?: string) {
    if (actorUserId && actorUserId === id) {
      throw new BadRequestException('You cannot deactivate your own account');
    }

    const user = await this.findOne(id, actorUserId);
    if (user.role === UserRole.ADMIN) {
      const activeAdmins = await this.prisma.user.count({
        where: {
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
          organizationId: user.organizationId,
        },
      });
      if (activeAdmins <= 1) {
        throw new BadRequestException('Cannot deactivate the last active admin');
      }
    }

    await this.prisma.user.update({
      where: { id },
      data: { status: UserStatus.INACTIVE },
    });
    if (user.role === UserRole.DRIVER) {
      await this.prisma.driver.updateMany({
        where: { userId: id },
        data: { isDeleted: true },
      });
    }
  }

  private assertManagedRole(role: UserRole) {
    if (!MANAGED_ROLES.includes(role)) {
      throw new BadRequestException(
        'Role must be ADMIN, DISPATCHER, DRIVER, or MECHANIC',
      );
    }
  }

  private assertDriverProfile(payload: any) {
    for (const key of [
      'licenseNumber',
      'licenseExpiry',
      'yearsOfExperience',
      'emergencyContact',
      'emergencyContactPhone',
    ]) {
      if (!payload[key]) {
        throw new BadRequestException(`${key} is required for driver users`);
      }
    }
  }

  private staffSelect() {
    return {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      role: true,
      status: true,
      organizationId: true,
      createdAt: true,
      updatedAt: true,
      driver: {
        select: {
          id: true,
          licenseNumber: true,
          licenseExpiry: true,
          yearsOfExperience: true,
          emergencyContact: true,
          emergencyContactPhone: true,
          availabilityStatus: true,
        },
      },
    };
  }
}
