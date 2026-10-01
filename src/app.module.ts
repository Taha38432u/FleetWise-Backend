import { Module, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { VehicleModule } from './vehicle/vehicle.module';
import { DriverModule } from './driver/driver.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { DemoReadOnlyGuard } from './common/guards/demo-read-only.guard';
import { AnalyticsModule } from './analytics/analytics.module';
import { NotificationsModule } from './notifications/notifications.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { RoutesModule } from './routes/routes.module';
import { AttendanceModule } from './attendance/attendance.module';
import { FinanceModule } from './finance/finance.module';
import { ReportsModule } from './reports/reports.module';
import { BillingModule } from './billing/billing.module';
import { TrackingModule } from './tracking/tracking.module';
import { StaffModule } from './staff/staff.module';
import { SuperAdminModule } from './super-admin/super-admin.module';
import { FuelModule } from './fuel/fuel.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AuthModule,
    VehicleModule,
    DriverModule,
    AnalyticsModule,
    NotificationsModule,
    MaintenanceModule,
    RoutesModule,
    AttendanceModule,
    FinanceModule,
    ReportsModule,
    BillingModule,
    TrackingModule,
    StaffModule,
    SuperAdminModule,
    FuelModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: DemoReadOnlyGuard,
    },
    {
      provide: APP_PIPE,
      useClass: ValidationPipe,
    },
  ],
})
export class AppModule {}
