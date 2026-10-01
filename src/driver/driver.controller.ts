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
import { DriverService } from './driver.service';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import { CreateDriverWithUserDto } from './dto/create-driver-with-user.dto';
import { UpdateDriverWithUserDto } from './dto/update-driver-with-user.dto';
import {
  DriverResponseDto,
  DriverDetailResponseDto,
  DriverWithUserResponseDto,
} from './dto/driver-response.dto';
import { CreateDrivingRecordDto } from './dto/create-driving-record.dto';
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

@Controller('drivers')
@ApiBearerAuth('JWT-auth')
@Roles(UserRole.ADMIN, UserRole.DISPATCHER)
export class DriverController {
  constructor(private readonly driverService: DriverService) {}

  @Post()
  @ApiOperation({
    summary: 'Create driver profile with new user (auto-verified)',
  })
  @ApiResponse({
    status: 201,
    description: 'Driver and user created successfully',
    schema: {
      example: {
        ok: true,
        data: {
          user: {
            id: 'uuid',
            email: 'newemail@company.com',
            firstName: 'Jane',
            lastName: 'Smith',
            phone: '+91-9876543211',
            role: 'DRIVER',
            status: 'ACTIVE',
            emailVerified: true,
            createdAt: '2024-01-01T00:00:00.000Z',
          },
          driver: {
            id: 'uuid',
            userId: 'uuid',
            licenseNumber: 'DL9876543210',
            licenseExpiry: '2027-12-31T00:00:00.000Z',
            licenseStatus: 'Valid',
            yearsOfExperience: 6,
            emergencyContact: 'John Smith',
            emergencyContactPhone: '+91-9876543212',
            availabilityStatus: 'On Duty',
            documentVerified: true,
            backgroundCheckDone: true,
            backgroundCheckDate: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-03T00:00:00.000Z',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'Email already exists or driver with license number already exists',
  })
  async createWithUser(
    @CurrentUser() user: JwtUserPayload,
    @Body() createDriverWithUserDto: CreateDriverWithUserDto,
  ): Promise<GetOneApiResponse<DriverWithUserResponseDto>> {
    const result = await this.driverService.createWithUser(
      createDriverWithUserDto,
      user.id,
    );
    return {
      ok: true,
      data: result,
    };
  }

  @Post(':userId')
  @ApiOperation({ summary: 'Create driver profile for a user' })
  @ApiParam({ name: 'userId', example: 'uuid', description: 'User ID' })
  @ApiResponse({
    status: 201,
    description: 'Driver profile created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid user or driver already exists',
  })
  async create(
    @CurrentUser() user: JwtUserPayload,
    @Param('userId') userId: string,
    @Body() createDriverDto: CreateDriverDto,
  ): Promise<GetOneApiResponse<DriverResponseDto>> {
    const driver = await this.driverService.create(userId, createDriverDto, user.id);
    return {
      ok: true,
      data: driver,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all drivers with filters' })
  @ApiQuery({ name: 'page', example: 1, required: false })
  @ApiQuery({ name: 'pageSize', example: 10, required: false })
  @ApiQuery({
    name: 'licenseStatus',
    enum: ['Valid', 'Expired', 'Suspended', 'Pending Verification'],
    required: false,
  })
  @ApiQuery({
    name: 'availabilityStatus',
    enum: ['Available', 'On Duty', 'Off Duty', 'On Leave'],
    required: false,
  })
  @ApiQuery({
    name: 'search',
    example: 'DL1234567890',
    required: false,
    description: 'Search by license number, email, or name',
  })
  @ApiQuery({
    name: 'isVehicleAssigned',
    example: 'true',
    required: false,
    description:
      'If provided, returns only drivers who do NOT have a vehicle assigned',
  })
  @ApiResponse({ status: 200, description: 'Drivers retrieved successfully' })
  async findAll(
    @CurrentUser() user: JwtUserPayload,
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '10',
    @Query('licenseStatus') licenseStatus?: string,
    @Query('availabilityStatus') availabilityStatus?: string,
    @Query('search') search?: string,
    @Query('isVehicleAssigned') isVehicleAssigned?: string,
  ): Promise<GetApiResponse<DriverResponseDto>> {
    const result = await this.driverService.findAll(
      parseInt(page),
      parseInt(pageSize),
      licenseStatus,
      availabilityStatus,
      search,
      isVehicleAssigned,
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

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get driver profile by user ID' })
  @ApiParam({ name: 'userId', example: 'uuid', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Driver found' })
  @ApiResponse({ status: 404, description: 'Driver not found' })
  async findByUserId(
    @CurrentUser() user: JwtUserPayload,
    @Param('userId') userId: string,
  ): Promise<GetOneApiResponse<DriverDetailResponseDto>> {
    const driver = await this.driverService.findByUserId(userId, user.id);
    return {
      ok: true,
      data: driver,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get driver details by ID' })
  @ApiParam({ name: 'id', example: 'uuid', description: 'Driver ID' })
  @ApiResponse({ status: 200, description: 'Driver found' })
  @ApiResponse({ status: 404, description: 'Driver not found' })
  async findOne(
    @CurrentUser() user: JwtUserPayload,
    @Param('id') id: string,
  ): Promise<GetOneApiResponse<DriverDetailResponseDto>> {
    const driver = await this.driverService.findOne(id, user.id);
    return {
      ok: true,
      data: driver,
    };
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update driver profile with user details (user & driver)',
  })
  @ApiParam({ name: 'id', example: 'uuid', description: 'Driver ID' })
  @ApiResponse({
    status: 200,
    description: 'Driver and user updated successfully',
    schema: {
      example: {
        ok: true,
        data: {
          user: {
            id: 'uuid',
            email: 'newemail@company.com',
            firstName: 'Jane',
            lastName: 'Smith',
            phone: '+91-9876543211',
            role: 'DRIVER',
            status: 'ACTIVE',
            emailVerified: true,
            createdAt: '2024-01-01T00:00:00.000Z',
          },
          driver: {
            id: 'uuid',
            userId: 'uuid',
            licenseNumber: 'DL9876543210',
            licenseExpiry: '2027-12-31T00:00:00.000Z',
            licenseStatus: 'Valid',
            yearsOfExperience: 6,
            emergencyContact: 'John Smith',
            emergencyContactPhone: '+91-9876543212',
            availabilityStatus: 'On Duty',
            documentVerified: true,
            backgroundCheckDone: true,
            backgroundCheckDate: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-03T00:00:00.000Z',
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Driver not found' })
  @ApiResponse({
    status: 400,
    description: 'Email or license number already exists',
  })
  async updateWithUser(
    @CurrentUser() user: JwtUserPayload,
    @Param('id') id: string,
    @Body() updateDriverWithUserDto: UpdateDriverWithUserDto,
  ): Promise<GetOneApiResponse<DriverWithUserResponseDto>> {
    const result = await this.driverService.updateWithUser(
      id,
      updateDriverWithUserDto,
      user.id,
    );
    return {
      ok: true,
      data: result,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete driver profile' })
  @ApiParam({ name: 'id', example: 'uuid', description: 'Driver ID' })
  @ApiResponse({ status: 204, description: 'Driver deleted successfully' })
  @ApiResponse({ status: 404, description: 'Driver not found' })
  async delete(
    @CurrentUser() user: JwtUserPayload,
    @Param('id') id: string,
  ): Promise<void> {
    await this.driverService.delete(id, user.id);
  }

  @Post(':id/assign-vehicle/:vehicleId')
  @ApiOperation({ summary: 'Assign vehicle to driver' })
  @ApiParam({ name: 'id', example: 'uuid', description: 'Driver ID' })
  @ApiParam({ name: 'vehicleId', example: 'uuid', description: 'Vehicle ID' })
  @ApiResponse({ status: 200, description: 'Vehicle assigned successfully' })
  async assignVehicle(
    @CurrentUser() user: JwtUserPayload,
    @Param('id') id: string,
    @Param('vehicleId') vehicleId: string,
  ): Promise<GetOneApiResponse<DriverDetailResponseDto>> {
    const driver = await this.driverService.assignVehicle(id, vehicleId, user.id);
    return {
      ok: true,
      data: driver,
    };
  }

  @Post(':vehicleId/unassign-vehicle')
  @ApiOperation({ summary: 'Unassign vehicle from driver' })
  @ApiParam({ name: 'vehicleId', example: 'uuid', description: 'Vehicle ID' })
  @ApiResponse({ status: 204, description: 'Vehicle unassigned successfully' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async unassignVehicle(
    @CurrentUser() user: JwtUserPayload,
    @Param('vehicleId') vehicleId: string,
  ): Promise<void> {
    await this.driverService.unassignVehicle(vehicleId, user.id);
  }

  @Post(':id/driving-records')
  @ApiOperation({ summary: 'Add driving record for driver' })
  @ApiParam({ name: 'id', example: 'uuid', description: 'Driver ID' })
  @ApiResponse({ status: 201, description: 'Driving record created' })
  async addDrivingRecord(
    @CurrentUser() user: JwtUserPayload,
    @Param('id') id: string,
    @Body() createRecordDto: CreateDrivingRecordDto,
  ): Promise<GetOneApiResponse<any>> {
    const record = await this.driverService.addDrivingRecord(
      id,
      createRecordDto,
      user.id,
    );
    return {
      ok: true,
      data: record,
    };
  }

  @Get(':id/driving-records')
  @ApiOperation({ summary: 'Get driving history for driver' })
  @ApiParam({ name: 'id', example: 'uuid', description: 'Driver ID' })
  @ApiQuery({ name: 'page', example: 1, required: false })
  @ApiQuery({ name: 'pageSize', example: 10, required: false })
  @ApiResponse({ status: 200, description: 'Driving history retrieved' })
  async getDrivingHistory(
    @CurrentUser() user: JwtUserPayload,
    @Param('id') id: string,
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '10',
  ): Promise<GetApiResponse<any>> {
    const result = await this.driverService.getDrivingHistory(
      id,
      parseInt(page),
      parseInt(pageSize),
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
}
