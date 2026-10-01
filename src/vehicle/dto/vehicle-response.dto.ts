import { ApiProperty } from '@nestjs/swagger';

export class VehicleResponseDto {
  @ApiProperty({ example: 'uuid', description: 'Vehicle unique identifier' })
  id: string;

  @ApiProperty({ example: 'ABC-123', description: 'Vehicle registration plate' })
  plate: string;

  @ApiProperty({ example: 'Truck', description: 'Type of vehicle' })
  type: string;

  @ApiProperty({ example: 'Volvo FH16', description: 'Vehicle model' })
  model: string;

  @ApiProperty({ example: 2023, description: 'Manufacturing year' })
  year: number;

  @ApiProperty({ example: 'Active', description: 'Current vehicle status' })
  status: string;

  @ApiProperty({ example: 50000, description: 'Mileage in kilometers' })
  mileage: number;

  @ApiProperty({ example: 5.5, description: 'Fuel efficiency in km/L' })
  fuelEfficiency: number;

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
    description: 'Last service date',
  })
  lastService: string | null;

  @ApiProperty({
    example: '2024-06-01T00:00:00.000Z',
    description: 'Next predicted maintenance date',
  })
  nextPredictedMaintenance: string | null;

  @ApiProperty({ example: 'uuid', description: 'Assigned driver id' })
  assignedDriverId: string | null;

  @ApiProperty({ example: 'John Doe', description: 'Assigned driver full name' })
  assignedDriver: string | null;

  @ApiProperty({ required: false, description: 'Current active route if assigned' })
  activeRoute?: any;

  @ApiProperty({ required: false, description: 'Latest route for this vehicle' })
  lastRoute?: any;

  @ApiProperty({ required: false, description: 'Latest persisted GPS location' })
  latestLocation?: any;

  @ApiProperty({ required: false, description: 'Open maintenance item count' })
  openMaintenanceCount?: number;

  @ApiProperty({ required: false, description: 'Open predictive alerts' })
  predictiveAlerts?: any[];

  @ApiProperty({
    example: '2025-12-31T00:00:00.000Z',
    description: 'Insurance expiry date',
  })
  insuranceExpiry: string | null;

  @ApiProperty({
    example: '2025-06-30T00:00:00.000Z',
    description: 'Fitness certificate expiry date',
  })
  fitnessExpiry: string | null;

  @ApiProperty({ example: 85, description: 'Health score 0-100' })
  healthScore: number;

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
    description: 'Record creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
    description: 'Record last update timestamp',
  })
  updatedAt: Date;
}
