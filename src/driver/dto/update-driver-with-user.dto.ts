import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsInt,
  IsDateString,
  IsOptional,
  IsEmail,
  Min,
  Max,
} from 'class-validator';

export class UpdateUserForDriverDto {
  @ApiProperty({
    example: 'driver@company.com',
    description: 'User email address',
    required: false,
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({
    example: 'John',
    description: 'First name',
    required: false,
  })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiProperty({
    example: 'Doe',
    description: 'Last name',
    required: false,
  })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiProperty({
    example: '+91-9876543210',
    description: 'Phone number',
    required: false,
  })
  @IsString()
  @IsOptional()
  phone?: string;
}

export class UpdateDriverWithUserDto {
  @ApiProperty({
    type: UpdateUserForDriverDto,
    description: 'User information to update',
    required: false,
  })
  @IsOptional()
  user?: UpdateUserForDriverDto;

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
    example: 'Valid',
    description: 'License status',
    required: false,
  })
  @IsOptional()
  @IsString()
  licenseStatus?: string;

  @ApiProperty({
    example: 5,
    description: 'Years of driving experience',
    required: false,
  })
  @IsInt()
  @IsOptional()
  @Min(0)
  @Max(100)
  yearsOfExperience?: number;

  @ApiProperty({
    example: 'Jane Doe',
    description: 'Emergency contact name',
    required: false,
  })
  @IsString()
  @IsOptional()
  emergencyContact?: string;

  @ApiProperty({
    example: '+91-9876543211',
    description: 'Emergency contact phone',
    required: false,
  })
  @IsString()
  @IsOptional()
  emergencyContactPhone?: string;

  @ApiProperty({
    example: 'Available',
    description: 'Availability status',
    required: false,
  })
  @IsOptional()
  @IsString()
  availabilityStatus?: string;

  @ApiProperty({
    example: true,
    description: 'Document verification status',
    required: false,
  })
  @IsOptional()
  documentVerified?: boolean;

  @ApiProperty({
    example: true,
    description: 'Background check completion status',
    required: false,
  })
  @IsOptional()
  backgroundCheckDone?: boolean;
}
