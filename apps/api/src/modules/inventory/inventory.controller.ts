import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { requireManager } from '../auth/authorization.js';
import { AdjustStockDto } from './inventory.dto.js';
import { InventoryService } from './inventory.service.js';
@Controller('admin/inventory')
@UseGuards(AuthGuard)
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}
  @Get() list() {
    return this.inventory.list();
  }
  @Patch('adjust') adjust(@Body() body: AdjustStockDto, @Req() request: AuthenticatedRequest) {
    requireManager(request.admin);
    return this.inventory.adjust(body, request.admin.id);
  }
}
