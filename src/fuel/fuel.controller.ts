import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { FuelService } from './fuel.service';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@Controller('fuel')
@Roles(UserRole.ADMIN, UserRole.DISPATCHER)
export class FuelController {
  constructor(private readonly svc: FuelService) {}

  @Post()
  async log(@Body() d: any) {
    return { ok: true, data: await this.svc.log(d) };
  }

  @Get('vehicle/:id')
  async byVehicle(@Param('id') id: string) {
    return {
      ok: true,
      data: await this.svc.getByVehicle(id),
      efficiency: await this.svc.efficiency(id),
    };
  }
}
