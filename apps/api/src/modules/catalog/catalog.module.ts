import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CatalogController } from './catalog.controller.js';
import { CatalogService } from './catalog.service.js';
import { MediaService } from './media.service.js';
@Module({
  imports: [AuthModule],
  controllers: [CatalogController],
  providers: [CatalogService, MediaService]
})
export class CatalogModule {}
