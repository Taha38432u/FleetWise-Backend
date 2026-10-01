import { BadRequestException, ConflictException } from '@nestjs/common';
import { UserRole } from '../common/enums/user-role.enum';
import { StaffService } from './staff.service';

describe('StaffService', () => {
  const staffSelectResult = {
    id: 'driver-user-id',
    email: 'driver@example.com',
    firstName: 'Driver',
    lastName: 'One',
    phone: null,
    role: UserRole.DRIVER,
    status: 'ACTIVE',
    organizationId: 'org-id',
    createdAt: new Date(),
    updatedAt: new Date(),
    driver: {
      id: 'driver-id',
      licenseNumber: 'LIC-1',
      licenseExpiry: new Date('2027-01-01'),
      yearsOfExperience: 4,
      emergencyContact: 'Family',
      emergencyContactPhone: '555',
      availabilityStatus: 'AVAILABLE',
    },
  };

  const createService = () => {
    const tx = {
      user: {
        create: jest.fn().mockResolvedValue({ id: 'driver-user-id' }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(staffSelectResult),
      },
      driver: {
        create: jest.fn().mockResolvedValue({ id: 'driver-id' }),
      },
    };
    const prisma: any = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(staffSelectResult),
        findMany: jest.fn().mockResolvedValue([staffSelectResult]),
        count: jest.fn().mockResolvedValue(1),
        create: jest.fn().mockResolvedValue(staffSelectResult),
        update: jest.fn().mockResolvedValue(staffSelectResult),
      },
      driver: {
        findUnique: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({ id: 'driver-id' }),
        upsert: jest.fn().mockResolvedValue({ id: 'driver-id' }),
      },
      $transaction: jest.fn((callback) => callback(tx)),
      __tx: tx,
    };
    const billingService = {
      assertWithinLimit: jest.fn().mockResolvedValue(undefined),
    };
    return { service: new StaffService(prisma, billingService as any), prisma, billingService };
  };

  it('lists all managed roles including drivers', async () => {
    const { service, prisma } = createService();

    await service.findAll({ role: UserRole.DRIVER });

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { role: UserRole.DRIVER, organizationId: null },
      }),
    );
  });

  it('creates a driver user with a driver profile', async () => {
    const { service, prisma } = createService();

    const result = await service.create({
      email: 'driver@example.com',
      password: 'FleetWise123',
      firstName: 'Driver',
      lastName: 'One',
      role: UserRole.DRIVER,
      licenseNumber: 'LIC-1',
      licenseExpiry: '2027-01-01',
      yearsOfExperience: 4,
      emergencyContact: 'Family',
      emergencyContactPhone: '555',
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.__tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: UserRole.DRIVER }),
      }),
    );
    expect(prisma.__tx.driver.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'driver-user-id',
          licenseNumber: 'LIC-1',
        }),
      }),
    );
    expect(result).toEqual(staffSelectResult);
  });

  it('requires driver profile fields for driver users', async () => {
    const { service } = createService();

    await expect(
      service.create({
        email: 'driver@example.com',
        password: 'FleetWise123',
        firstName: 'Driver',
        lastName: 'One',
        role: UserRole.DRIVER,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects duplicate emails', async () => {
    const { service, prisma } = createService();
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'existing-id' });

    await expect(
      service.create({
        email: 'driver@example.com',
        password: 'FleetWise123',
        firstName: 'Driver',
        lastName: 'One',
        role: UserRole.MECHANIC,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('prevents self deactivation', async () => {
    const { service } = createService();

    await expect(service.deactivate('admin-id', 'admin-id')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('prevents deactivating the last active admin', async () => {
    const { service, prisma } = createService();
    prisma.user.findUnique.mockResolvedValueOnce({ organizationId: 'org-id' });
    prisma.user.findFirst.mockResolvedValueOnce({
      ...staffSelectResult,
      id: 'admin-id',
      role: UserRole.ADMIN,
    });
    prisma.user.count.mockResolvedValueOnce(1);

    await expect(service.deactivate('admin-id', 'other-admin-id')).rejects.toThrow(
      'Cannot deactivate the last active admin',
    );
  });

  it('checks plan limits when creating managed users', async () => {
    const { service, billingService } = createService();

    await service.create(
      {
        email: 'mechanic@example.com',
        password: 'FleetWise123',
        firstName: 'Mechanic',
        lastName: 'One',
        role: UserRole.MECHANIC,
      },
      'admin-id',
    );

    expect(billingService.assertWithinLimit).toHaveBeenCalledWith(
      'admin-id',
      'staff',
    );
  });
});
