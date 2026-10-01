import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { VehicleStatus, VehicleType } from './create-vehicle.dto';

export class UpdateVehicleDto {
  @ApiProperty({
    example: 'ABC-123',
    description: 'Vehicle registration plate',
    required: false,
  })
  @IsString()
  @IsOptional()
  plate?: string;

  @ApiProperty({
    enum: VehicleType,
    example: VehicleType.TRUCK,
    description: 'Type of vehicle',
    required: false,
  })
  @IsEnum(VehicleType)
  @IsOptional()
  type?: VehicleType;

  @ApiProperty({
    example: 'Volvo FH16',
    description: 'Vehicle model name',
    required: false,
  })
  @IsString()
  @IsOptional()
  model?: string;

  @ApiProperty({
    example: 2023,
    description: 'Manufacturing year',
    required: false,
  })
  @IsInt()
  @IsOptional()
  @Min(1900)
  @Max(new Date().getFullYear() + 1)
  year?: number;

  @ApiProperty({
    enum: VehicleStatus,
    example: VehicleStatus.ACTIVE,
    description: 'Current status of vehicle',
    required: false,
  })
  @IsEnum(VehicleStatus)
  @IsOptional()
  status?: VehicleStatus;

  @ApiProperty({
    example: 50000,
    description: 'Mileage in kilometers',
    required: false,
  })
  @IsInt()
  @IsOptional()
  @Min(0)
  mileage?: number;

  @ApiProperty({
    example: 5.5,
    description: 'Fuel efficiency in km/L',
    required: false,
  })
  @IsOptional()
  fuelEfficiency?: number;

  @ApiProperty({
    example: '2024-01-01T00:00:00Z',
    description: 'Last service date',
    required: false,
  })
  @IsString()
  @IsOptional()
  lastService?: string;

  @ApiProperty({
    example: '2024-06-01T00:00:00Z',
    description: 'Next predicted maintenance date',
    required: false,
  })
  @IsString()
  @IsOptional()
  nextPredictedMaintenance?: string;

  @ApiProperty({
    example: 'uuid',
    description: 'Assigned driver id',
    required: false,
  })
  @IsString()
  @IsOptional()
  assignedDriverId?: string;

  @ApiProperty({
    example: '2025-12-31T00:00:00Z',
    description: 'Insurance expiry date',
    required: false,
  })
  @IsString()
  @IsOptional()
  insuranceExpiry?: string;

  @ApiProperty({
    example: '2025-06-30T00:00:00Z',
    description: 'Fitness certificate expiry date',
    required: false,
  })
  @IsString()
  @IsOptional()
  fitnessExpiry?: string;

  @ApiProperty({
    example: 85,
    description: 'Health score 0-100',
    required: false,
  })
  @IsInt()
  @IsOptional()
  @Min(0)
  @Max(100)
  healthScore?: number;
}
