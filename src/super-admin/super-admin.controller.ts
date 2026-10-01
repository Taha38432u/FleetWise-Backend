import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { SuperAdminService } from './super-admin.service';

@ApiTags('super-admin')
@Controller('super-admin')
@ApiBearerAuth('JWT-auth')
@Roles(UserRole.SUPER_ADMIN)
export class SuperAdminController {
  constructor(private readonly superAdminService: SuperAdminService) {}

  @Get('overview')
  @ApiOperation({ summary: 'SaaS owner overview metrics' })
  async overview() {
    const data = await this.superAdminService.overview();
    return { ok: true, data };
  }

  @Get('users')
  @ApiOperation({ summary: 'List all SaaS users' })
  async users(@Query() query: any) {
    const result = await this.superAdminService.users(query);
    return { ok: true, data: result.data, meta: result.meta };
  }

  @Get('subscriptions')
  @ApiOperation({ summary: 'List SaaS subscriptions and payment states' })
  async subscriptions(@Query() query: any) {
    const result = await this.superAdminService.subscriptions(query);
    return { ok: true, data: result.data, meta: result.meta };
  }

  @Post('organizations/:adminUserId/deactivate')
  @ApiOperation({ summary: 'Deactivate an admin organization' })
  async deactivateOrganization(@Param('adminUserId') adminUserId: string) {
    const data = await this.superAdminService.deactivateOrganization(adminUserId);
    return { ok: true, data };
  }

  @Post('organizations/:adminUserId/reset')
  @ApiOperation({ summary: 'Reset an admin organization data' })
  async resetOrganization(@Param('adminUserId') adminUserId: string) {
    const data = await this.superAdminService.resetOrganization(adminUserId);
    return { ok: true, data };
  }
}
