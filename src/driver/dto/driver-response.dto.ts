import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiProperty({ example: 'newemail@company.com' })
  email: string;

  @ApiProperty({ example: 'Jane' })
  firstName: string;

  @ApiProperty({ example: 'Smith' })
  lastName: string;

  @ApiProperty({ example: '+91-9876543211' })
  phone: string;

  @ApiProperty({ example: 'DRIVER' })
  role: string;

  @ApiProperty({ example: 'ACTIVE' })
  status: string;

  @ApiProperty({ example: true })
  emailVerified: boolean;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  createdAt: string;
}

export class DriverResponseDto {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiProperty({ example: 'uuid' })
  userId: string;
  @ApiProperty({ type: UserResponseDto, required: false })
  user?: UserResponseDto;

  @ApiProperty({ example: 'DL1234567890' })
  licenseNumber: string;

  @ApiProperty({ example: '2026-12-31T00:00:00.000Z' })
  licenseExpiry: string;

  @ApiProperty({ example: 'Valid' })
  licenseStatus: string;

  @ApiProperty({ example: 5 })
  yearsOfExperience: number;

  @ApiProperty({ example: 'John Doe' })
  emergencyContact: string;

  @ApiProperty({ example: '+91-9876543210' })
  emergencyContactPhone: string;

  @ApiProperty({ example: 'On Duty' })
  availabilityStatus: string;

  @ApiProperty({ example: true })
  documentVerified: boolean;

  @ApiProperty({ example: true })
  backgroundCheckDone: boolean;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  backgroundCheckDate: string | null;

  @ApiProperty({ example: '2024-01-03T00:00:00.000Z' })
  updatedAt: string;
}

export class DriverWithUserResponseDto {
  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;

  @ApiProperty({ type: DriverResponseDto })
  driver: DriverResponseDto;
}

export class DriverDetailResponseDto extends DriverResponseDto {
  // `user` is provided by the base `DriverResponseDto` when populated

  @ApiProperty({
    example: [
      {
        id: 'uuid',
        plate: 'ABC-123',
        type: 'Truck',
        model: 'Volvo FH16',
      },
    ],
  })
  assignedVehicles: any[];
}
