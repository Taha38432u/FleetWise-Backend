import { Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import type { JwtUserPayload } from '../common/types/jwt-payload.type';
import { AttendanceService } from './attendance.service';

@ApiTags('attendance')
@Controller('attendance')
@ApiBearerAuth('JWT-auth')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('check-in')
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Check in as a driver' })
  async checkIn(@CurrentUser() user: JwtUserPayload) {
    const data = await this.attendanceService.checkIn(user.id);
    return { ok: true, data };
  }

  @Post('check-out')
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Check out as a driver' })
  async checkOut(@CurrentUser() user: JwtUserPayload) {
    const data = await this.attendanceService.checkOut(user.id);
    return { ok: true, data };
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER)
  @ApiOperation({ summary: 'List attendance records' })
  async findAll(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('driverId') driverId?: string,
  ) {
    const result = await this.attendanceService.findAll(
      parseInt(page, 10),
      parseInt(pageSize, 10),
      driverId,
    );
    return { ok: true, data: result.data, meta: result.meta };
  }

  @Get('me')
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'List attendance history for the current driver' })
  async findMine(
    @CurrentUser() user: JwtUserPayload,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    const result = await this.attendanceService.findMyHistory(
      user.id,
      parseInt(page, 10),
      parseInt(pageSize, 10),
    );
    return { ok: true, data: result.data, meta: result.meta };
  }
}
