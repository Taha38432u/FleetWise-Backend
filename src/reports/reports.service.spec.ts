import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  const createService = () => {
    const prisma: any = {
      vehicle: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'vehicle-id',
            plate: 'ABC-100',
            status: 'ACTIVE',
            routes: [{ id: 'route-id' }],
            maintenanceRecords: [],
          },
        ]),
      },
      driver: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'driver-id',
            status: 'ACTIVE',
            user: { firstName: 'Driver', lastName: 'One' },
            routes: [{ id: 'route-id' }],
          },
        ]),
      },
      route: {
        groupBy: jest.fn().mockResolvedValue([
          { status: 'COMPLETED', _count: { status: 2 } },
          { status: 'CANCELLED', _count: { status: 1 } },
        ]),
      },
      subscription: {
        groupBy: jest.fn().mockResolvedValue([
          { status: 'TRIALING', _count: { status: 3 } },
        ]),
        count: jest.fn().mockResolvedValueOnce(3).mockResolvedValueOnce(1),
      },
      attendanceRecord: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      maintenanceRecord: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const financeService: any = {
      getCostSummary: jest.fn().mockResolvedValue({
        total: 1000,
        totals: {
          fuel: 100,
          driverSalaries: 500,
          mechanicLabor: 200,
          routeExpenses: 200,
        },
        byDriver: [{ driverId: 'driver-id', salary: 500 }],
        mechanicLaborRows: [],
      }),
    };

    return { service: new ReportsService(prisma, financeService), prisma, financeService };
  };

  it('builds in-app report dashboard data', async () => {
    const { service } = createService();

    const report = await service.operationsDashboard();

    expect(report.summary.totalCost).toBe(1000);
    expect(report.summary.driverSalaryCost).toBe(500);
    expect(report.summary.completedRoutes).toBe(2);
    expect(report.summary.abandonedRoutes).toBe(1);
    expect(report.vehicleUtilization).toHaveLength(1);
    expect(report.driverActivity[0].name).toBe('Driver One');
  });
});
