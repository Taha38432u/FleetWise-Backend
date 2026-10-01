import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { RoutesService } from './routes.service';

describe('RoutesService', () => {
  const driver = { id: 'driver-id', userId: 'driver-user-id', isDeleted: false };
  const scheduledRoute = {
    id: 'route-id',
    name: 'Morning Delivery',
    status: 'SCHEDULED',
    driverId: 'driver-id',
    vehicleId: 'vehicle-id',
  };
  const inProgressRoute = {
    ...scheduledRoute,
    status: 'IN_PROGRESS',
  };

  const createService = () => {
    const prisma: any = {
      driver: {
        findFirst: jest.fn().mockResolvedValue(driver),
      },
      route: {
        create: jest.fn().mockResolvedValue(scheduledRoute),
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(scheduledRoute)
          .mockResolvedValue(inProgressRoute),
        findFirst: jest.fn().mockImplementation(({ where }: any = {}) => {
          if (where?.id === 'route-id') {
            return Promise.resolve(inProgressRoute);
          }
          return Promise.resolve(null);
        }),
        update: jest.fn().mockResolvedValue(inProgressRoute),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      vehicle: {
        findFirst: jest.fn().mockResolvedValue({ id: 'vehicle-id', isDeleted: false }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'driver-user-id',
          firstName: 'Driver',
          lastName: 'One',
        }),
      },
    };
    const notificationsService = {
      notifyRoles: jest.fn().mockResolvedValue(undefined),
      create: jest.fn().mockResolvedValue(undefined),
    };
    const billingService = {
      assertWithinLimit: jest.fn().mockResolvedValue(undefined),
    };
    return {
      service: new RoutesService(prisma, notificationsService as any, billingService as any),
      prisma,
      notificationsService,
      billingService,
    };
  };

  it('lets the assigned driver start a scheduled route', async () => {
    const { service, prisma, notificationsService } = createService();

    const result = await service.updateDriverStatus(
      'route-id',
      'driver-user-id',
      'IN_PROGRESS',
    );

    expect(prisma.route.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'route-id' },
        data: expect.objectContaining({
          status: 'IN_PROGRESS',
          actualStartAt: expect.any(Date),
        }),
      }),
    );
    expect(notificationsService.notifyRoles).toHaveBeenCalledWith(
      ['ADMIN', 'DISPATCHER'],
      expect.objectContaining({
        title: 'Route status updated',
        type: 'SYSTEM',
        actionUrl: '/routes',
      }),
    );
    expect(result.status).toBe('IN_PROGRESS');
  });

  it('blocks a driver from updating another driver route', async () => {
    const { service, prisma } = createService();
    prisma.route.findUnique = jest.fn().mockResolvedValue({
      ...scheduledRoute,
      driverId: 'other-driver-id',
    });

    await expect(
      service.updateDriverStatus('route-id', 'driver-user-id', 'IN_PROGRESS'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets drivers view only assigned route details', async () => {
    const { service, prisma } = createService();
    prisma.route.findFirst = jest.fn().mockResolvedValue({
      ...scheduledRoute,
      driverId: 'driver-id',
      driver: { user: { id: 'driver-user-id' } },
      vehicle: { gpsLogs: [] },
    });

    const result = await service.findOneForUser('route-id', {
      id: 'driver-user-id',
      email: 'driver@test.local',
      role: 'DRIVER',
    } as any);

    expect(result.id).toBe('route-id');
  });

  it('blocks drivers from viewing another driver route detail', async () => {
    const { service, prisma } = createService();
    prisma.route.findFirst = jest.fn().mockResolvedValue({
      ...scheduledRoute,
      driverId: 'other-driver-id',
      driver: { user: { id: 'other-user-id' } },
      vehicle: { gpsLogs: [] },
    });

    await expect(
      service.findOneForUser('route-id', {
        id: 'driver-user-id',
        email: 'driver@test.local',
        role: 'DRIVER',
      } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks completing a route that is not in progress', async () => {
    const { service } = createService();

    await expect(
      service.updateDriverStatus('route-id', 'driver-user-id', 'COMPLETED'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not fail the route update when notification delivery fails', async () => {
    const { service, notificationsService } = createService();
    notificationsService.notifyRoles.mockRejectedValueOnce(
      new Error('notification failed'),
    );

    const result = await service.updateDriverStatus(
      'route-id',
      'driver-user-id',
      'IN_PROGRESS',
    );

    expect(result.status).toBe('IN_PROGRESS');
  });

  it('blocks assigning one vehicle to two active routes', async () => {
    const { service, prisma } = createService();
    prisma.route.findFirst.mockResolvedValueOnce({
      id: 'other-route-id',
      status: 'IN_PROGRESS',
      vehicleId: 'vehicle-id',
    });

    await expect(
      service.create(
        {
          name: 'Duplicate',
          startLocation: 'A',
          endLocation: 'B',
          scheduledAt: new Date().toISOString(),
          vehicleId: 'vehicle-id',
        },
        'admin-id',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks assigning one driver to two active routes', async () => {
    const { service, prisma } = createService();
    prisma.route.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'other-route-id',
        status: 'IN_PROGRESS',
        driverId: 'driver-id',
      });

    await expect(
      service.create(
        {
          name: 'Duplicate driver',
          startLocation: 'A',
          endLocation: 'B',
          scheduledAt: new Date().toISOString(),
          vehicleId: 'vehicle-id',
          driverId: 'driver-id',
        },
        'admin-id',
      ),
    ).rejects.toThrow('Driver is already assigned to an active route');
  });

  it('rejects route assignment to a missing driver', async () => {
    const { service, prisma } = createService();
    prisma.driver.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.create(
        {
          name: 'Missing driver',
          startLocation: 'A',
          endLocation: 'B',
          scheduledAt: new Date().toISOString(),
          vehicleId: 'vehicle-id',
          driverId: 'missing-driver-id',
        },
        'admin-id',
      ),
    ).rejects.toThrow('Driver not found');
  });

  it('creates route only after backend plan check', async () => {
    const { service, billingService } = createService();

    await service.create(
      {
        name: 'Morning Delivery',
        startLocation: 'A',
        endLocation: 'B',
        scheduledAt: new Date().toISOString(),
        vehicleId: 'vehicle-id',
      },
      'admin-id',
    );

    expect(billingService.assertWithinLimit).toHaveBeenCalledWith(
      'admin-id',
      'activeRoutes',
    );
  });

  it('returns latest GPS location for the route vehicle', async () => {
    const { service, prisma } = createService();
    const gpsLog = {
      id: 'gps-id',
      vehicleId: 'vehicle-id',
      latitude: 24.8607,
      longitude: 67.0011,
      timestamp: new Date(),
    };
    prisma.route.findFirst = jest.fn().mockResolvedValue({
      ...scheduledRoute,
      vehicle: { gpsLogs: [gpsLog] },
    });

    const result = await service.getCurrentLocation('route-id');

    expect(result).toEqual({
      routeId: 'route-id',
      vehicleId: 'vehicle-id',
      location: gpsLog,
    });
  });

  it('rejects current location lookup for a route without vehicle', async () => {
    const { service, prisma } = createService();
    prisma.route.findFirst = jest.fn().mockResolvedValue({
      ...scheduledRoute,
      vehicleId: null,
      vehicle: null,
    });

    await expect(service.getCurrentLocation('route-id')).rejects.toThrow(
      'Route has no assigned vehicle',
    );
  });
});
