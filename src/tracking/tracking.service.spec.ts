import { ForbiddenException } from '@nestjs/common';
import { TrackingService } from './tracking.service';

describe('TrackingService', () => {
  const createService = () => {
    const prisma: any = {
      driver: {
        findFirst: jest.fn().mockResolvedValue({ id: 'driver-id', userId: 'driver-user-id' }),
      },
      route: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'route-id',
          driverId: 'driver-id',
          vehicleId: 'vehicle-id',
          status: 'IN_PROGRESS',
        }),
      },
      vehicle: {
        findFirst: jest.fn().mockResolvedValue({ id: 'vehicle-id', isDeleted: false }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ organizationId: 'org-id' }),
      },
      gpsLog: {
        create: jest.fn().mockResolvedValue({ id: 'gps-id', vehicleId: 'vehicle-id' }),
      },
    };

    return { service: new TrackingService(prisma), prisma };
  };

  it('lets drivers save GPS only for their assigned active route vehicle', async () => {
    const { service, prisma } = createService();

    await service.saveLocationForUser(
      {
        vehicleId: 'vehicle-id',
        latitude: 24.86,
        longitude: 67.01,
      },
      { id: 'driver-user-id', email: 'driver@test.local', role: 'DRIVER' } as any,
    );

    expect(prisma.gpsLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ vehicleId: 'vehicle-id' }),
      }),
    );
  });

  it('persists simulated GPS speed, heading, and timestamp', async () => {
    const { service, prisma } = createService();
    const timestamp = '2026-06-15T09:00:00.000Z';

    await service.saveLocationForUser(
      {
        vehicleId: 'vehicle-id',
        latitude: 24.9,
        longitude: 67.05,
        speed: 48,
        heading: 91,
        timestamp,
      },
      { id: 'driver-user-id', email: 'driver@test.local', role: 'DRIVER' } as any,
    );

    expect(prisma.gpsLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          speed: 48,
          heading: 91,
          timestamp: new Date(timestamp),
        }),
      }),
    );
  });

  it('blocks drivers from saving GPS for unassigned vehicles', async () => {
    const { service, prisma } = createService();
    prisma.route.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.saveLocationForUser(
        {
          vehicleId: 'other-vehicle-id',
          latitude: 24.86,
          longitude: 67.01,
        },
        { id: 'driver-user-id', email: 'driver@test.local', role: 'DRIVER' } as any,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
