import { AuthService } from './auth.service';
import { UserRole } from '../common/enums/user-role.enum';
import { UserStatus } from '../common/enums/user-status.enum';

describe('AuthService', () => {
  const createService = () => {
    const prisma: any = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'user-id',
            email: data.email,
            firstName: data.firstName,
            lastName: data.lastName,
            phone: data.phone,
            role: data.role,
            status: data.status,
            emailVerified: data.emailVerified,
          }),
        ),
        update: jest.fn().mockResolvedValue({ id: 'user-id' }),
      },
      organization: {
        create: jest.fn().mockResolvedValue({ id: 'organization-id' }),
      },
      refreshToken: {
        create: jest.fn().mockResolvedValue({ id: 'refresh-token-id' }),
      },
    };
    const jwtService: any = {
      sign: jest.fn().mockImplementation((payload) =>
        payload?.tokenId ? 'refresh-token' : 'access-token',
      ),
    };
    const configService: any = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'JWT_REFRESH_SECRET') return 'refresh-secret';
        if (key === 'JWT_EXPIRES_IN') return '8h';
        if (key === 'JWT_REFRESH_EXPIRES_IN') return '7d';
        return undefined;
      }),
    };
    const emailService: any = {
      sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
    };

    return {
      service: new AuthService(
        prisma,
        jwtService,
        configService,
        emailService,
      ),
      prisma,
      emailService,
    };
  };

  it('forces public registration to create an admin fleet owner', async () => {
    const { service, prisma, emailService } = createService();

    const result = await service.register({
      email: 'owner@example.com',
      password: 'SecurePass123!',
      firstName: 'Fleet',
      lastName: 'Owner',
      role: UserRole.DRIVER,
    });

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
          subscription: {
            create: expect.objectContaining({
              plan: 'FREE',
              status: 'ACTIVE',
              trialUsed: false,
            }),
          },
        }),
      }),
    );
    expect(result.user.role).toBe(UserRole.ADMIN);
    expect(emailService.sendWelcomeEmail).toHaveBeenCalledWith(
      'owner@example.com',
      'Fleet',
    );
  });
});
