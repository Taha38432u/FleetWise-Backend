import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async checkIn(userId: string) {
    const driver = await this.prisma.driver.findFirst({
      where: { userId, isDeleted: false },
    });
    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }

    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const existing = await this.prisma.attendanceRecord.findFirst({
      where: {
        driverId: driver.id,
        date: { gte: dayStart },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existing?.checkInTime && !existing?.checkOutTime) {
      throw new BadRequestException('Driver is already checked in');
    }

    if (existing) {
      return this.prisma.attendanceRecord.update({
        where: { id: existing.id },
        data: {
          checkInTime: now,
          status: 'PRESENT',
          notes: existing.notes,
        },
      });
    }

    return this.prisma.attendanceRecord.create({
      data: {
        driverId: driver.id,
        date: dayStart,
        checkInTime: now,
        status: 'PRESENT',
      },
    });
  }

  async checkOut(userId: string) {
    const driver = await this.prisma.driver.findFirst({
      where: { userId, isDeleted: false },
    });
    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }

    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const record = await this.prisma.attendanceRecord.findFirst({
      where: {
        driverId: driver.id,
        date: { gte: dayStart },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record?.checkInTime) {
      throw new BadRequestException('Driver has not checked in today');
    }

    if (record.checkOutTime) {
      throw new BadRequestException('Driver has already checked out');
    }

    return this.prisma.attendanceRecord.update({
      where: { id: record.id },
      data: { checkOutTime: now },
    });
  }

  async findAll(page = 1, pageSize = 20, driverId?: string) {
    const skip = (page - 1) * pageSize;
    const where: any = {};
    if (driverId) where.driverId = driverId;

    const [data, totalItems] = await Promise.all([
      this.prisma.attendanceRecord.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          driver: {
            include: {
              user: true,
            },
          },
        },
        orderBy: { date: 'desc' },
      }),
      this.prisma.attendanceRecord.count({ where }),
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

  async findMyHistory(userId: string, page = 1, pageSize = 20) {
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

    return this.findAll(page, pageSize, driver.id);
  }
}
