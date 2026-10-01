import { FinanceService } from './finance.service';

describe('FinanceService', () => {
  const createService = () => {
    const prisma: any = {
      transaction: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'fuel-tx',
            type: 'EXPENSE',
            amount: 120,
            description: 'Diesel refill',
            vehicleId: 'vehicle-id',
            account: { type: 'FUEL' },
            category: { name: 'Fuel' },
          },
          {
            id: 'salary-tx',
            type: 'EXPENSE',
            amount: 900,
            description: 'Driver salary May',
            driverId: 'driver-id',
            account: { type: 'PAYROLL' },
            category: { name: 'Driver Salary' },
          },
        ]),
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }),
      },
      maintenanceRecord: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'maintenance-id',
            type: 'REPAIR',
            status: 'COMPLETED',
            cost: 250,
            mechanicId: 'mechanic-id',
            vehicleId: 'vehicle-id',
            vehicle: { plate: 'ABC-100' },
            mechanic: { firstName: 'Mech', lastName: 'One' },
          },
        ]),
      },
      recurringExpense: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValue([
            {
              id: 'insurance-id',
              isActive: true,
              amount: 300,
              name: 'Insurance',
              nextRunAt: new Date('2099-01-01'),
            },
          ]),
      },
      budget: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    return { service: new FinanceService(prisma), prisma };
  };

  it('calculates fleet costs by operational purpose', async () => {
    const { service } = createService();

    const summary = await service.getCostSummary();

    expect(summary.totals.fuel).toBe(120);
    expect(summary.totals.driverSalaries).toBe(900);
    expect(summary.totals.mechanicLabor).toBe(250);
    expect(summary.totals.recurring).toBe(300);
  });

  it('links mechanic work to vehicle maintenance rows', async () => {
    const { service } = createService();

    const summary = await service.getCostSummary();

    expect(summary.mechanicLaborRows).toEqual([
      expect.objectContaining({
        mechanicName: 'Mech One',
        vehiclePlate: 'ABC-100',
        amount: 250,
      }),
    ]);
  });
});
