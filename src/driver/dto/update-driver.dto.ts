import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsInt,
  IsDateString,
  IsOptional,
  Min,
  Max,
  IsBoolean,
  IsEnum,
} from 'class-validator';
import { AvailabilityStatus, LicenseStatus } from './create-driver.dto';

export class UpdateDriverDto {
  @ApiProperty({
    example: 'DL1234567890',
    description: 'Driving license number',
    required: false,
  })
  @IsString()
  @IsOptional()
  licenseNumber?: string;

  @ApiProperty({
    example: '2026-12-31T00:00:00Z',
    description: 'License expiry date',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  licenseExpiry?: string;

  @ApiProperty({
    enum: LicenseStatus,
    example: LicenseStatus.VALID,
    description: 'License status',
    required: false,
  })
  @IsEnum(LicenseStatus)
  @IsOptional()
  licenseStatus?: LicenseStatus;

  @ApiProperty({
    example: 5,
    description: 'Years of driving experience',
    required: false,
  })
  @IsInt()
  @IsOptional()
  @Min(0)
  @Max(70)
  yearsOfExperience?: number;

  @ApiProperty({
    example: 'John Doe',
    description: 'Emergency contact name',
    required: false,
  })
  @IsString()
  @IsOptional()
  emergencyContact?: string;

  @ApiProperty({
    example: '+91-9876543210',
    description: 'Emergency contact phone number',
    required: false,
  })
  @IsString()
  @IsOptional()
  emergencyContactPhone?: string;

  @ApiProperty({
    enum: AvailabilityStatus,
    example: AvailabilityStatus.AVAILABLE,
    description: 'Current availability status',
    required: false,
  })
  @IsEnum(AvailabilityStatus)
  @IsOptional()
  availabilityStatus?: AvailabilityStatus;

  @ApiProperty({
    example: true,
    description: 'Document verification status',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  documentVerified?: boolean;

  @ApiProperty({
    example: true,
    description: 'Background check status',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  backgroundCheckDone?: boolean;
}
