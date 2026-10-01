export type VehicleStatus = 'Active' | 'Idle' | 'In Maintenance' | 'Decommissioned';
export type VehicleType = 'Truck' | 'Van' | 'Car' | 'Bike';

export interface Vehicle {
  id: string;
  plate: string;
  type: VehicleType;
  model: string;
  year: number;
  status: VehicleStatus;
  mileage: number; // in km
  fuelEfficiency: number; // km/L
  lastService: string;
  nextPredictedMaintenance: string;
  assignedDriver: string;
  insuranceExpiry: string;
  fitnessExpiry: string;
  healthScore: number; // 0-100
}
