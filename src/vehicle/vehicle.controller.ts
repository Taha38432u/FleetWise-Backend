import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { VehicleService } from './vehicle.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { VehicleResponseDto } from './dto/vehicle-response.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUserPayload } from '../common/types/jwt-payload.type';

interface MetaData {
  totalItems: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

interface GetApiResponse<T> {
  ok: boolean;
  data: {
    data: T[];
    meta: MetaData;
  };
}

interface GetOneApiResponse<T> {
  ok: boolean;
  data: T;
}

@Controller('vehicles')
@ApiBearerAuth('JWT-auth')
@Roles(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.MECHANIC)
export class VehicleController {
  constructor(private readonly vehicleService: VehicleService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER)
  @ApiOperation({ summary: 'Create a new vehicle' })
  @ApiResponse({
    status: 201,
    description: 'Vehicle created successfully',
    schema: {
      example: {
        ok: true,
        data: {
          id: 'uuid',
          plate: 'ABC-123',
          type: 'Truck',
          model: 'Volvo FH16',
          year: 2023,
          status: 'Active',
          mileage: 50000,
          fuelEfficiency: 5.5,
          lastService: '2024-01-01T00:00:00.000Z',
          nextPredictedMaintenance: '2024-06-01T00:00:00.000Z',
          assignedDriver: 'John Doe',
          insuranceExpiry: '2025-12-31T00:00:00.000Z',
          fitnessExpiry: '2025-06-30T00:00:00.000Z',
          healthScore: 85,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      },
    },
  })
  async create(
    @CurrentUser() user: JwtUserPayload,
    @Body() createVehicleDto: CreateVehicleDto,
  ): Promise<GetOneApiResponse<VehicleResponseDto>> {
    const vehicle = await this.vehicleService.create(createVehicleDto, user.id);
    return {
      ok: true,
      data: vehicle,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all vehicles with pagination and filters' })
  @ApiQuery({ name: 'page', example: 1, required: false })
  @ApiQuery({ name: 'pageSize', example: 10, required: false })
  @ApiQuery({
    name: 'status',
    enum: ['Active', 'Idle', 'In Maintenance', 'Decommissioned'],
    required: false,
    description: 'Filter by vehicle status',
  })
  @ApiQuery({
    name: 'type',
    enum: ['Truck', 'Van', 'Car', 'Bike'],
    required: false,
    description: 'Filter by vehicle type',
  })
  @ApiQuery({
    name: 'search',
    example: 'ABC-123',
    required: false,
    description: 'Search by plate, model, or assigned driver name',
  })
  @ApiResponse({
    status: 200,
    description: 'Vehicles retrieved successfully',
    schema: {
      example: {
        ok: true,
        data: {
          data: [],
          meta: {
            totalItems: 0,
            totalPages: 0,
            currentPage: 1,
            pageSize: 10,
          },
        },
      },
    },
  })
  async findAll(
    @CurrentUser() user: JwtUserPayload,
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '10',
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('search') search?: string,
  ): Promise<GetApiResponse<VehicleResponseDto>> {
    const result = await this.vehicleService.findAll(
      parseInt(page),
      parseInt(pageSize),
      status,
      type,
      search,
      user.id,
    );
    return {
      ok: true,
      data: {
        data: result.data,
        meta: result.meta,
      },
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific vehicle by ID' })
  @ApiParam({ name: 'id', example: 'uuid', description: 'Vehicle ID' })
  @ApiResponse({ status: 200, description: 'Vehicle found' })
  @ApiResponse({ status: 404, description: 'Vehicle not found' })
  async findOne(
    @CurrentUser() user: JwtUserPayload,
    @Param('id') id: string,
  ): Promise<GetOneApiResponse<VehicleResponseDto>> {
    const vehicle = await this.vehicleService.findOne(id, user.id);
    return {
      ok: true,
      data: vehicle,
    };
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER)
  @ApiOperation({ summary: 'Update a vehicle' })
  @ApiParam({ name: 'id', example: 'uuid', description: 'Vehicle ID' })
  @ApiResponse({ status: 200, description: 'Vehicle updated successfully' })
  @ApiResponse({ status: 404, description: 'Vehicle not found' })
  async update(
    @CurrentUser() user: JwtUserPayload,
    @Param('id') id: string,
    @Body() updateVehicleDto: UpdateVehicleDto,
  ): Promise<GetOneApiResponse<VehicleResponseDto>> {
    const vehicle = await this.vehicleService.update(id, updateVehicleDto, user.id);
    return {
      ok: true,
      data: vehicle,
    };
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a vehicle' })
  @ApiParam({ name: 'id', example: 'uuid', description: 'Vehicle ID' })
  @ApiResponse({ status: 204, description: 'Vehicle deleted successfully' })
  @ApiResponse({ status: 404, description: 'Vehicle not found' })
  async delete(
    @CurrentUser() user: JwtUserPayload,
    @Param('id') id: string,
  ): Promise<void> {
    await this.vehicleService.delete(id, user.id);
  }
}
