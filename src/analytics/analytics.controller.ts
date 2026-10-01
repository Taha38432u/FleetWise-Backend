import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUserPayload } from '../common/types/jwt-payload.type';
import { AnalyticsService } from './analytics.service';

@ApiTags('analytics')
@Controller('analytics')
@ApiBearerAuth('JWT-auth')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get dashboard analytics summary' })
  async getSummary(@CurrentUser() user: JwtUserPayload) {
    const data = await this.analyticsService.getSummary(user);
    return { ok: true, data };
  }
}
