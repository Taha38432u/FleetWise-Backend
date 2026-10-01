import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsString,
  IsNotEmpty,
  Min,
  IsNumber,
  IsOptional,
} from 'class-validator';

export class CreateDrivingRecordDto {
  @ApiProperty({
    example: 'New York',
    description: 'Starting location',
  })
  @IsString()
  @IsNotEmpty()
  startLocation: string;

  @ApiProperty({
    example: 'Los Angeles',
    description: 'Ending location',
  })
  @IsString()
  @IsNotEmpty()
  endLocation: string;

  @ApiProperty({
    example: '2024-01-01T08:00:00Z',
    description: 'Trip start time',
  })
  @IsDateString()
  @IsNotEmpty()
  startTime: string;

  @ApiProperty({
    example: '2024-01-01T18:00:00Z',
    description: 'Trip end time',
  })
  @IsDateString()
  @IsOptional()
  endTime?: string;

  @ApiProperty({
    example: 2750,
    description: 'Distance traveled in kilometers',
  })
  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  distance: number;

  @ApiProperty({
    example: 450,
    description: 'Fuel used in liters',
  })
  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  fuelUsed: number;

  @ApiProperty({
    example: 'Smooth trip, no issues',
    description: 'Trip notes',
    required: false,
  })
  @IsString()
  @IsOptional()
  notes?: string;
}
