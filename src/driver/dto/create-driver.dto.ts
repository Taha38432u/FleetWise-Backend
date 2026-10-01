import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsDateString,
  IsOptional,
  Min,
  Max,
  IsBoolean,
  IsEnum,
} from 'class-validator';

export enum LicenseStatus {
  VALID = 'Valid',
  EXPIRED = 'Expired',
  SUSPENDED = 'Suspended',
  PENDING_VERIFICATION = 'Pending Verification',
}

export enum AvailabilityStatus {
  AVAILABLE = 'Available',
  ON_DUTY = 'On Duty',
  OFF_DUTY = 'Off Duty',
  ON_LEAVE = 'On Leave',
}

export class CreateDriverDto {
  @ApiProperty({
    example: 'DL1234567890',
    description: 'Driving license number',
  })
  @IsString()
  @IsNotEmpty()
  licenseNumber: string;

  @ApiProperty({
    example: '2026-12-31T00:00:00Z',
    description: 'License expiry date',
  })
  @IsDateString()
  @IsNotEmpty()
  licenseExpiry: string;

  @ApiProperty({
    enum: LicenseStatus,
    example: LicenseStatus.PENDING_VERIFICATION,
    description: 'License status',
    required: false,
  })
  @IsEnum(LicenseStatus)
  @IsOptional()
  licenseStatus?: LicenseStatus = LicenseStatus.PENDING_VERIFICATION;

  @ApiProperty({
    example: 5,
    description: 'Years of driving experience',
  })
  @IsInt()
  @IsNotEmpty()
  @Min(0)
  @Max(70)
  yearsOfExperience: number;

  @ApiProperty({
    example: 'John Doe',
    description: 'Emergency contact name',
  })
  @IsString()
  @IsNotEmpty()
  emergencyContact: string;

  @ApiProperty({
    example: '+91-9876543210',
    description: 'Emergency contact phone number',
  })
  @IsString()
  @IsNotEmpty()
  emergencyContactPhone: string;

  @ApiProperty({
    enum: AvailabilityStatus,
    example: AvailabilityStatus.AVAILABLE,
    description: 'Current availability status',
    required: false,
  })
  @IsEnum(AvailabilityStatus)
  @IsOptional()
  availabilityStatus?: AvailabilityStatus = AvailabilityStatus.AVAILABLE;

  @ApiProperty({
    example: true,
    description: 'Document verification status',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  documentVerified?: boolean = false;

  @ApiProperty({
    example: true,
    description: 'Background check status',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  backgroundCheckDone?: boolean = false;
}
