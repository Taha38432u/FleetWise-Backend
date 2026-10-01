import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import type { JwtUserPayload } from '../common/types/jwt-payload.type';
import { BillingService } from './billing.service';

@ApiTags('billing')
@Controller('billing')
@ApiBearerAuth('JWT-auth')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('plans')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List available plans' })
  getPlans() {
    return { ok: true, data: this.billingService.getPlans() };
  }

  @Get('subscription')
  @Roles(
    UserRole.ADMIN,
    UserRole.DISPATCHER,
    UserRole.DRIVER,
    UserRole.MECHANIC,
  )
  @ApiOperation({ summary: 'Get the current subscription' })
  async getSubscription(@CurrentUser() user: JwtUserPayload) {
    const data = await this.billingService.getCurrentSubscription(user.id);
    return { ok: true, data };
  }

  @Post('create-checkout-session')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a checkout session' })
  async createCheckoutSession(
    @CurrentUser() user: JwtUserPayload,
    @Body() payload: { plan: string },
  ) {
    const data = await this.billingService.createCheckoutSession(
      user.id,
      payload.plan,
    );
    return { ok: true, data };
  }

  @Post('start-trial')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Start the one-time free trial' })
  async startTrial(@CurrentUser() user: JwtUserPayload) {
    const data = await this.billingService.createTrial(user.id);
    return { ok: true, data };
  }

  @Post('complete-checkout-session')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Verify and complete a Stripe test checkout session',
  })
  async completeCheckoutSession(
    @CurrentUser() user: JwtUserPayload,
    @Body() payload: { sessionId: string },
  ) {
    const data = await this.billingService.completeCheckoutSession(
      user.id,
      payload.sessionId,
    );
    return { ok: true, data };
  }

  @Post('cancel')
  @Roles(UserRole.ADMIN)
  async cancel(@CurrentUser() user: JwtUserPayload) {
    const data = await this.billingService.cancel(user.id);
    return { ok: true, data };
  }

  @Post('reactivate')
  @Roles(UserRole.ADMIN)
  async reactivate(@CurrentUser() user: JwtUserPayload) {
    const data = await this.billingService.reactivate(user.id);
    return { ok: true, data };
  }

  @Public()
  @Post('webhook')
  async webhook(@Body() payload: any) {
    return this.billingService.webhook(payload);
  }
}
