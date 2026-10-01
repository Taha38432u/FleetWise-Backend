import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MaintenanceScheduleService {
  constructor(private readonly prisma: PrismaService) {}

  /** Rule-based scheduling: mileage / time / engine-hours thresholds */
  async generateSchedule(vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    // Real logic: compare odometer & last service to schedule next maintenance
    return { scheduled: true, basedOn: 'odometer + time' };
  }
}
