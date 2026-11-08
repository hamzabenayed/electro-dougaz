import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';
import { SettingsModule } from '../settings/settings.module.js';
import { ReportingService } from './reporting.service.js';
@Module({
  imports: [AuthModule, SettingsModule],
  controllers: [OrdersController],
  providers: [OrdersService, ReportingService]
})
export class OrdersModule {}
