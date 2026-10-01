import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
@Injectable()
export class FuelRepository {
  constructor(private readonly prisma: PrismaService) {}
  async create(data: any) { return this.prisma.fuelLog.create({ data }); }
  async findByVehicle(vehicleId: string) { return this.prisma.fuelLog.findMany({ where: { vehicleId } }); }
}
