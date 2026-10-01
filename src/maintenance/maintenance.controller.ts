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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUserPayload } from '../common/types/jwt-payload.type';
import { MaintenanceService } from './maintenance.service';

@ApiTags('maintenance')
@Controller('maintenance')
@ApiBearerAuth('JWT-auth')
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER)
  @ApiOperation({ summary: 'Create a maintenance record' })
  async create(@CurrentUser() user: JwtUserPayload, @Body() payload: any) {
    const data = await this.maintenanceService.create(payload, user);
    return { ok: true, data };
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.MECHANIC)
  @ApiOperation({ summary: 'List maintenance records' })
  async findAll(@CurrentUser() user: JwtUserPayload, @Query() query: any) {
    const result = await this.maintenanceService.findAllForUser(query, user);
    return { ok: true, data: result.data, meta: result.meta };
  }

  @Get('predictions')
  @Roles(UserRole.ADMIN, UserRole.MECHANIC)
  @ApiOperation({ summary: 'List active predictive alerts' })
  async listPredictions(@CurrentUser() user: JwtUserPayload, @Query() query: any) {
    const data = await this.maintenanceService.listPredictionsForUser(user, query);
    return { ok: true, data };
  }

  @Get('ai/health')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Check Python AI service health' })
  async aiHealth() {
    const data = await this.maintenanceService.aiHealth();
    return { ok: true, data };
  }

  @Get('ai/model-info')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get Python AI model info' })
  async aiModelInfo() {
    const data = await this.maintenanceService.aiModelInfo();
    return { ok: true, data };
  }

  @Post('predict/:vehicleId')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Generate a predictive maintenance alert' })
  async predict(
    @CurrentUser() user: JwtUserPayload,
    @Param('vehicleId') vehicleId: string,
  ) {
    const data = await this.maintenanceService.predictForUser(vehicleId, user);
    return { ok: true, data };
  }

  @Get('vehicle/:id')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.MECHANIC)
  @ApiOperation({ summary: 'List maintenance records for a vehicle' })
  async findByVehicle(@CurrentUser() user: JwtUserPayload, @Param('id') id: string) {
    const data = await this.maintenanceService.findByVehicleForUser(id, user);
    return { ok: true, data };
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.MECHANIC)
  @ApiOperation({ summary: 'Get a maintenance record' })
  async findOne(@CurrentUser() user: JwtUserPayload, @Param('id') id: string) {
    const data = await this.maintenanceService.findOneForUser(id, user);
    return { ok: true, data };
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.MECHANIC)
  @ApiOperation({ summary: 'Update a maintenance record' })
  async update(
    @CurrentUser() user: JwtUserPayload,
    @Param('id') id: string,
    @Body() payload: any,
  ) {
    const data = await this.maintenanceService.updateForUser(id, payload, user);
    return { ok: true, data };
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a maintenance record' })
  async remove(@CurrentUser() user: JwtUserPayload, @Param('id') id: string) {
    await this.maintenanceService.remove(id, user);
  }
}
