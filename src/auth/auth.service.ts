import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { JwtRefreshPayload } from './strategies/jwt-refresh.strategy';
import { randomBytes } from 'crypto';
import { UserStatus } from '../common/enums/user-status.enum';
import { UserRole } from '../common/enums/user-role.enum';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const { email, password, firstName, lastName, phone } = registerDto;
    const role = UserRole.ADMIN;

    if (email.trim().toLowerCase().endsWith('@demo.com')) {
      throw new BadRequestException(
        'Emails on @demo.com are reserved for read-only demos and cannot be registered.',
      );
    }

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        phone,
        role,
        status: UserStatus.ACTIVE,
        emailVerified: false,
        subscription: {
          create: {
            plan: 'FREE',
            status: 'ACTIVE',
            paymentStatus: 'NONE',
            provider: 'STRIPE_TEST',
            trialUsed: false,
          } as any,
        },
      } as any,
    });

    try {
      const organization = await (this.prisma as any).organization.create({
        data: {
          name: `${firstName}'s Fleet`,
          ownerUserId: user.id,
        },
      });
      await this.prisma.user.update({
        where: { id: user.id },
        data: { organizationId: organization.id } as any,
      });
    } catch {
      // Existing databases without the organization migration can still register users.
    }

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email, user.role);

    // Send welcome email
    try {
      await this.emailService.sendWelcomeEmail(user.email, user.firstName);
    } catch (error) {
      console.error('Failed to send welcome email:', error);
      // Don't fail registration if email fails
    }

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role as any,
        status: user.status as any,
        emailVerified: user.emailVerified,
      },
    };
  }

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return null;
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Account is not active');
    }

    const { password: _, ...result } = user;
    return result;
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.validateUser(loginDto.email, loginDto.password);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email, user.role);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
        emailVerified: user.emailVerified,
      },
    };
  }

  async refreshToken(
    userId: string,
    tokenId: string,
  ): Promise<AuthResponseDto> {
    const token = await this.prisma.refreshToken.findUnique({
      where: { id: tokenId },
      include: { user: true },
    });

    if (!token || token.revokedAt || token.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (token.user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('User is not active');
    }

    if (token.userId !== userId) {
      throw new UnauthorizedException('Token mismatch');
    }

    // Revoke old token
    await this.prisma.refreshToken.update({
      where: { id: token.id },
      data: { revokedAt: new Date() },
    });

    // Generate new tokens
    const newTokens = await this.generateTokens(
      token.user.id,
      token.user.email,
      token.user.role,
    );

    return {
      ...newTokens,
      user: {
        id: token.user.id,
        email: token.user.email,
        firstName: token.user.firstName,
        lastName: token.user.lastName,
        role: token.user.role as any,
        status: token.user.status as any,
        emailVerified: token.user.emailVerified,
      },
    };
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto): Promise<void> {
    const { email } = forgotPasswordDto;

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    // Don't reveal if user exists (security best practice)
    if (!user) {
      return;
    }

    // Generate reset token
    const resetToken = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour expiry

    // Save reset token
    await this.prisma.passwordResetToken.create({
      data: {
        token: resetToken,
        userId: user.id,
        expiresAt,
      },
    });

    // Send reset email
    await this.emailService.sendPasswordResetEmail(
      user.email,
      resetToken,
      user.firstName,
    );
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<void> {
    const { token, newPassword } = resetPasswordDto;

    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!resetToken) {
      throw new NotFoundException('Invalid reset token');
    }

    if (resetToken.used) {
      throw new BadRequestException('Reset token has already been used');
    }

    if (resetToken.expiresAt < new Date()) {
      throw new BadRequestException('Reset token has expired');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and mark token as used
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetToken.userId },
        data: { password: hashedPassword },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { used: true },
      }),
    ]);
  }

  async logout(userId: string, refreshTokenId?: string): Promise<void> {
    if (refreshTokenId) {
      await this.prisma.refreshToken.update({
        where: { id: refreshTokenId },
        data: { revokedAt: new Date() },
      });
    } else {
      // Revoke all refresh tokens for the user
      await this.prisma.refreshToken.updateMany({
        where: {
          userId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    }
  }

  async updateMe(userId: string, update: { firstName?: string; lastName?: string; phone?: string; }) {
    const data: Record<string, any> = {};
    if (update.firstName !== undefined) data.firstName = update.firstName;
    if (update.lastName !== undefined) data.lastName = update.lastName;
    if (update.phone !== undefined) data.phone = update.phone;

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No fields provided to update');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
    });

    return user;
  }

  private async generateTokens(
    userId: string,
    email: string,
    role: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: JwtPayload = {
      sub: userId,
      email,
      role,
    };

    const accessToken = this.jwtService.sign(
      payload as any,
      {
        expiresIn: (this.configService.get<string>('JWT_EXPIRES_IN') ||
          '8h') as any,
      } as any,
    );

    // Create refresh token record
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    // Generate a unique token for the refresh token record
    const refreshTokenValue = randomBytes(32).toString('hex');

    const refreshTokenRecord = await this.prisma.refreshToken.create({
      data: {
        token: refreshTokenValue,
        userId,
        expiresAt,
      },
    });

    const refreshPayload: JwtRefreshPayload = {
      sub: userId,
      tokenId: refreshTokenRecord.id,
    };

    // For refresh token, we need to use a different secret
    // So we'll use the JWT service with custom options
    const jwtRefreshSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET');
    if (!jwtRefreshSecret) {
      throw new Error('JWT_REFRESH_SECRET is not configured');
    }

    const refreshToken = this.jwtService.sign(
      refreshPayload as any,
      {
        secret: jwtRefreshSecret,
        expiresIn:
          this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d',
      } as any,
    );

    return { accessToken, refreshToken };
  }
}
