import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { StaffService } from './staff.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUserPayload } from '../common/types/jwt-payload.type';

@ApiTags('staff')
@Controller('staff')
@ApiBearerAuth('JWT-auth')
@Roles(UserRole.ADMIN)
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  @ApiOperation({ summary: 'List managed users by role' })
  async findAll(@CurrentUser() user: JwtUserPayload, @Query() query: any) {
    const result = await this.staffService.findAll(query, user.id);
    return { ok: true, data: result.data, meta: result.meta };
  }

  @Post()
  @ApiOperation({ summary: 'Create admin, dispatcher, mechanic, or driver user' })
  async create(@CurrentUser() user: JwtUserPayload, @Body() payload: any) {
    const data = await this.staffService.create(payload, user.id);
    return { ok: true, data };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update managed user' })
  async update(
    @CurrentUser() user: JwtUserPayload,
    @Param('id') id: string,
    @Body() payload: any,
  ) {
    const data = await this.staffService.update(id, payload, user.id);
    return { ok: true, data };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deactivate managed user' })
  async deactivate(@CurrentUser() user: JwtUserPayload, @Param('id') id: string) {
    await this.staffService.deactivate(id, user.id);
  }
}
