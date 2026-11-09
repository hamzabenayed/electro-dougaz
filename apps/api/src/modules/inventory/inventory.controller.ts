import { Body, Controller, Get, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { requireManager } from '../auth/authorization.js';
import { AdjustStockDto, StockHistoryQueryDto } from './inventory.dto.js';
import { InventoryService } from './inventory.service.js';
@Controller('admin/inventory')
@UseGuards(AuthGuard)
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}
  @Get() list() {
    return this.inventory.list();
  }
  @Get('history') history(@Query() query: StockHistoryQueryDto) {
    return this.inventory.history(query);
  }
  @Patch('adjust') adjust(@Body() body: AdjustStockDto, @Req() request: AuthenticatedRequest) {
    requireManager(request.admin);
    return this.inventory.adjust(body, request.admin.id);
  }
}
