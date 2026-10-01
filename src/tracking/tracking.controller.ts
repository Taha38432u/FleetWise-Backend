import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { TrackingGateway } from './tracking.gateway';
import { TrackingService } from './tracking.service';
import { BillingService } from '../billing/billing.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUserPayload } from '../common/types/jwt-payload.type';

@ApiTags('tracking')
@Controller('tracking')
@ApiBearerAuth('JWT-auth')
export class TrackingController {
  constructor(
    private readonly trackingService: TrackingService,
    private readonly trackingGateway: TrackingGateway,
    private readonly billingService: BillingService,
  ) {}

  @Post('location')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.DRIVER)
  @ApiOperation({ summary: 'Save a GPS location update' })
  async saveLocation(
    @CurrentUser() user: JwtUserPayload,
    @Body() payload: any,
  ) {
    const data = await this.trackingService.saveLocationForUser(payload, user);
    await this.trackingGateway.broadcastLocation(data);
    return { ok: true, data };
  }

  @Get(':vehicleId')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER)
  @ApiOperation({ summary: 'Get the latest known location for a vehicle' })
  async getLatest(
    @CurrentUser() user: JwtUserPayload,
    @Param('vehicleId') vehicleId: string,
  ) {
    await this.billingService.assertFeature(user.id, 'liveTracking');
    const data = await this.trackingService.getLatest(vehicleId, user.id);
    return { ok: true, data };
  }

  @Get(':vehicleId/history')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER)
  @ApiOperation({ summary: 'Get tracking history for a vehicle' })
  async getHistory(
    @Param('vehicleId') vehicleId: string,
    @CurrentUser() user: JwtUserPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    await this.billingService.assertFeature(user.id, 'liveTracking');
    const data = await this.trackingService.getHistory(vehicleId, from, to, user.id);
    return { ok: true, data };
  }
}
