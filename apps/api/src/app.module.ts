import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './modules/health/health.module.js';
import { validateEnvironment } from './config/environment.js';
import { DatabaseModule } from './database/database.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { InventoryModule } from './modules/inventory/inventory.module.js';
import { OrdersModule } from './modules/orders/orders.module.js';
import { SettingsModule } from './modules/settings/settings.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['../../.env', '.env'],
      validate: validateEnvironment
    }),
    DatabaseModule,
    AuthModule,
    CatalogModule,
    InventoryModule,
    OrdersModule,
    SettingsModule,
    HealthModule
  ]
})
export class AppModule {}
