import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { ReportsService } from './reports.service';
import { BillingService } from '../billing/billing.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUserPayload } from '../common/types/jwt-payload.type';

function toCsv(rows: any[]) {
  if (!rows.length) {
    return '';
  }

  const headers = Array.from<string>(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set<string>()),
  );

  const lines = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((header) => {
          const value = row[header];
          if (value === null || typeof value === 'undefined') return '';
          const normalized =
            typeof value === 'object' ? JSON.stringify(value) : String(value);
          return `"${normalized.replace(/"/g, '""')}"`;
        })
        .join(','),
    ),
  ];

  return lines.join('\n');
}

@ApiTags('reports')
@Controller('reports')
@ApiBearerAuth('JWT-auth')
@Roles(UserRole.ADMIN, UserRole.DISPATCHER)
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly billingService: BillingService,
  ) {}

  private async sendReport(
    user: JwtUserPayload,
    res: Response,
    format: string | undefined,
    name: string,
    data: any,
  ) {
    if (format === 'csv') {
      await this.billingService.assertFeature(user.id, 'reportsExport');
      const rows = Array.isArray(data) ? data : [data];
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${name}.csv"`);
      return res.send(toCsv(rows));
    }

    return res.send({ ok: true, data });
  }

  @Get('fleet-summary')
  @ApiOperation({ summary: 'Get fleet summary report' })
  async fleetSummary(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('format') format: string | undefined,
    @CurrentUser() user: JwtUserPayload,
    @Res() res: Response,
  ) {
    const data = await this.reportsService.fleetSummary(from, to);
    return this.sendReport(user, res, format, 'fleet-summary', data);
  }

  @Get('operations-dashboard')
  @ApiOperation({ summary: 'Get in-app operational report dashboard' })
  async operationsDashboard(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
  ) {
    const data = await this.reportsService.operationsDashboard(from, to);
    return { ok: true, data };
  }

  @Get('driver-performance')
  async driverPerformance(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('format') format: string | undefined,
    @CurrentUser() user: JwtUserPayload,
    @Res() res: Response,
  ) {
    const data = await this.reportsService.driverPerformance(from, to);
    return this.sendReport(user, res, format, 'driver-performance', data);
  }

  @Get('maintenance-history')
  async maintenanceHistory(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('format') format: string | undefined,
    @CurrentUser() user: JwtUserPayload,
    @Res() res: Response,
  ) {
    const data = await this.reportsService.maintenanceHistory(from, to);
    return this.sendReport(user, res, format, 'maintenance-history', data);
  }

  @Get('fuel-consumption')
  async fuelConsumption(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('format') format: string | undefined,
    @CurrentUser() user: JwtUserPayload,
    @Res() res: Response,
  ) {
    const data = await this.reportsService.fuelConsumption(from, to);
    return this.sendReport(user, res, format, 'fuel-consumption', data);
  }

  @Get('route-efficiency')
  async routeEfficiency(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('format') format: string | undefined,
    @CurrentUser() user: JwtUserPayload,
    @Res() res: Response,
  ) {
    const data = await this.reportsService.routeEfficiency(from, to);
    return this.sendReport(user, res, format, 'route-efficiency', data);
  }

  @Get('budget-vs-actual')
  async budgetVsActual(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('format') format: string | undefined,
    @CurrentUser() user: JwtUserPayload,
    @Res() res: Response,
  ) {
    const data = await this.reportsService.budgetVsActual(from, to);
    return this.sendReport(user, res, format, 'budget-vs-actual', data);
  }
}
