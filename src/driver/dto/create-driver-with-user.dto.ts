import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsDateString,
  IsOptional,
  IsEmail,
  Min,
  Max,
  IsEnum,
} from 'class-validator';
import { LicenseStatus } from './create-driver.dto';

export class CreateUserForDriverDto {
  @ApiProperty({
    example: 'driver@company.com',
    description: 'User email address',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: 'John',
    description: 'First name',
  })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({
    example: 'Doe',
    description: 'Last name',
  })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({
    example: '+91-9876543210',
    description: 'Phone number',
    required: false,
  })
  @IsString()
  @IsOptional()
  phone?: string;
}

export class CreateDriverWithUserDto {
  @ApiProperty({
    type: CreateUserForDriverDto,
    description: 'User information',
  })
  @IsNotEmpty()
  user: CreateUserForDriverDto;

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
  @Max(100)
  yearsOfExperience: number;

  @ApiProperty({
    example: 'Jane Doe',
    description: 'Emergency contact name',
  })
  @IsString()
  @IsNotEmpty()
  emergencyContact: string;

  @ApiProperty({
    example: '+91-9876543211',
    description: 'Emergency contact phone',
  })
  @IsString()
  @IsNotEmpty()
  emergencyContactPhone: string;

  @ApiProperty({
    example: 'Available',
    description: 'Initial availability status',
    required: false,
  })
  @IsOptional()
  @IsString()
  availabilityStatus?: string;

  @ApiProperty({
    example: false,
    description: 'Document verification status',
    required: false,
  })
  @IsOptional()
  documentVerified?: boolean;

  @ApiProperty({
    example: false,
    description: 'Background check completion status',
    required: false,
  })
  @IsOptional()
  backgroundCheckDone?: boolean;
}
