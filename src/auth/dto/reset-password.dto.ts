import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({
    example: 'reset-token-from-email',
    description: 'Password reset token received via email',
  })
  @IsString()
  token: string;

  @ApiProperty({
    example: 'NewSecurePass123!',
    description: 'New password (min 8 characters)',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  newPassword: string;
}
