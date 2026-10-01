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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import type { JwtUserPayload } from '../common/types/jwt-payload.type';
import { RoutesService } from './routes.service';

@ApiTags('routes')
@Controller('routes')
@ApiBearerAuth('JWT-auth')
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER)
  @ApiOperation({ summary: 'Create a route assignment' })
  async create(@CurrentUser() user: JwtUserPayload, @Body() payload: any) {
    const data = await this.routesService.create(payload, user.id);
    return { ok: true, data };
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER)
  @ApiOperation({ summary: 'List routes' })
  async findAll(@CurrentUser() user: JwtUserPayload, @Query() query: any) {
    const result = await this.routesService.findAll(query, user.id);
    return { ok: true, data: result.data, meta: result.meta };
  }

  @Get('me')
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'List routes for the current driver' })
  async findMine(
    @CurrentUser() user: JwtUserPayload,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '10',
  ) {
    const result = await this.routesService.findByDriverUserId(
      user.id,
      parseInt(page, 10),
      parseInt(pageSize, 10),
    );
    return { ok: true, data: result.data, meta: result.meta };
  }

  @Get('driver/:id')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER)
  @ApiOperation({ summary: 'List routes for a driver' })
  async findByDriver(
    @CurrentUser() user: JwtUserPayload,
    @Param('id') id: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '10',
  ) {
    const result = await this.routesService.findByDriverId(
      id,
      parseInt(page, 10),
      parseInt(pageSize, 10),
      user.id,
    );
    return { ok: true, data: result.data, meta: result.meta };
  }

  @Get(':id/location')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER)
  @ApiOperation({ summary: 'Get the latest GPS location for a route vehicle' })
  async getCurrentLocation(@CurrentUser() user: JwtUserPayload, @Param('id') id: string) {
    const data = await this.routesService.getCurrentLocation(id, user.id);
    return { ok: true, data };
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.DRIVER)
  @ApiOperation({ summary: 'Get a route' })
  async findOne(@CurrentUser() user: JwtUserPayload, @Param('id') id: string) {
    const data = await this.routesService.findOneForUser(id, user);
    return { ok: true, data };
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER)
  @ApiOperation({ summary: 'Update a route' })
  async update(
    @CurrentUser() user: JwtUserPayload,
    @Param('id') id: string,
    @Body() payload: any,
  ) {
    const data = await this.routesService.update(id, payload, user.id);
    return { ok: true, data };
  }

  @Patch(':id/driver-status')
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Driver updates assigned route status' })
  async updateDriverStatus(
    @CurrentUser() user: JwtUserPayload,
    @Param('id') id: string,
    @Body() payload: any,
  ) {
    const data = await this.routesService.updateDriverStatus(
      id,
      user.id,
      payload.status,
      payload,
    );
    return { ok: true, data };
  }

  @Post(':id/request-location')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER)
  @ApiOperation({ summary: 'Request live location update from assigned driver' })
  async requestLocation(@CurrentUser() user: JwtUserPayload, @Param('id') id: string) {
    const data = await this.routesService.requestLocationUpdate(id, user.id);
    return { ok: true, data };
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a route' })
  async remove(@CurrentUser() user: JwtUserPayload, @Param('id') id: string) {
    await this.routesService.remove(id, user.id);
  }
}
