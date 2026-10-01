import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VehicleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(where?: any, skip?: number, take?: number) {
    const [data, count] = await Promise.all([
      this.prisma.vehicle.findMany({ where: { ...where, isDeleted: false }, skip, take, orderBy: { createdAt: 'desc' } }),
      this.prisma.vehicle.count({ where: { ...where, isDeleted: false } }),
    ]);
    return { data, meta: { total: count, skip, take } };
  }

  async findById(id: string) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id, isDeleted: false } });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    return vehicle;
  }

  async create(data: any) {
    return this.prisma.vehicle.create({ data: { ...data, isDeleted: false } });
  }

  async update(id: string, data: any) {
    return this.prisma.vehicle.update({ where: { id }, data });
  }

  async softDelete(id: string) {
    return this.prisma.vehicle.update({ where: { id }, data: { isDeleted: true } });
  }
}
