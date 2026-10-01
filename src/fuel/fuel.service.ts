import { Injectable } from '@nestjs/common';
import { FuelRepository } from './fuel.repository';

@Injectable()
export class FuelService {
  constructor(private readonly repo: FuelRepository) {}
  async log(data: any) { return this.repo.create(data); }
  async getByVehicle(vehicleId: string) { return this.repo.findByVehicle(vehicleId); }
  async efficiency(vehicleId: string) { const logs = await this.repo.findByVehicle(vehicleId); if (!logs.length) return 0; const totalL = logs.reduce((s,l)=>s+l.liters,0); const dist = logs[logs.length-1].odometer - logs[0].odometer; return dist / totalL; }
}
