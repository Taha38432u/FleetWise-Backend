import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  const createService = () => {
    const prisma: any = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ organizationId: 'org-id' }),
      },
      vehicle: {
        count: jest.fn().mockResolvedValue(0),
      },
      driver: {
        count: jest.fn().mockResolvedValue(0),
      },
      route: {
        count: jest.fn().mockResolvedValue(0),
      },
      notification: {
        count: jest.fn().mockResolvedValue(0),
      },
      predictiveAlert: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      transaction: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 125 } }),
      },
      maintenanceRecord: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { cost: 250 } }),
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      recurringExpense: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 75 } }),
      },
      subscription: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    return { service: new AnalyticsService(prisma), prisma };
  };

  it('calculates monthly cost from transactions, maintenance, and recurring expenses', async () => {
    const { service, prisma } = createService();

    const result = await service.getSummary({
      id: 'admin-id',
      role: 'ADMIN',
      email: 'admin@example.com',
    } as any);

    expect(result.summary.monthlyCost).toBe('$450.00');
    expect(prisma.transaction.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: 'EXPENSE',
          organizationId: 'org-id',
        }),
      }),
    );
    expect(prisma.maintenanceRecord.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          vehicle: { organizationId: 'org-id' },
        }),
      }),
    );
    expect(prisma.recurringExpense.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true, organizationId: 'org-id' },
      }),
    );
  });
});
