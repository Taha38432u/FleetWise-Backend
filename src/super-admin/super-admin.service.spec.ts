import { SuperAdminService } from './super-admin.service';

describe('SuperAdminService', () => {
  const createService = () => {
    const prisma: any = {
      user: {
        count: jest.fn().mockResolvedValue(4),
        findMany: jest.fn().mockResolvedValue([{ id: 'user-id' }]),
      },
      subscription: {
        count: jest.fn().mockResolvedValue(1),
        groupBy: jest.fn().mockResolvedValue([{ plan: 'FREE', _count: { plan: 1 } }]),
        findMany: jest.fn().mockResolvedValue([{ id: 'sub-id' }]),
      },
    };
    const billingService = {
      syncPendingPayments: jest.fn().mockResolvedValue([]),
    };
    return {
      service: new SuperAdminService(prisma, billingService as any),
      prisma,
      billingService,
    };
  };

  it('returns SaaS owner health metrics', async () => {
    const { service, prisma, billingService } = createService();

    const result = await service.overview();

    expect(billingService.syncPendingPayments).toHaveBeenCalled();
    expect(result.totalUsers).toBe(4);
    expect(result.paymentStatus.pendingPayments).toBe(1);
    expect(result.planDistribution).toEqual([{ plan: 'FREE', _count: { plan: 1 } }]);
    expect(result).not.toHaveProperty('totalOrganizations');
    expect(prisma.user.count).toHaveBeenCalledWith({
      where: {
        role: 'ADMIN',
        subscription: { isNot: null },
      },
    });
    expect(prisma.subscription.count).toHaveBeenCalledWith({
      where: { paymentStatus: 'PENDING', user: { role: 'ADMIN' } },
    });
  });

  it('syncs pending Stripe payments before listing subscriptions', async () => {
    const { service, billingService } = createService();

    await service.subscriptions({ page: 1, pageSize: 10 });

    expect(billingService.syncPendingPayments).toHaveBeenCalled();
  });

  it('lists only subscribed admin accounts for owner console', async () => {
    const { service, prisma } = createService();

    await service.users({ page: 1, pageSize: 10 });

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          role: 'ADMIN',
          subscription: { isNot: null },
        },
        include: { subscription: true, organization: true },
      }),
    );
  });
});
