import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import {
  CreateOrderDto,
  OrderQueryDto,
  TrackOrderDto,
  UpdateOrderStatusDto,
  QuoteOrderDto
} from './orders.dto.js';
import { OrdersService } from './orders.service.js';
import { ReportingService } from './reporting.service.js';
import { requireManager } from '../auth/authorization.js';
import { ReportQueryDto, PaymentEventDto } from './reporting.dto.js';
@Controller()
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly reports: ReportingService
  ) {}
  @Get('admin/reports') @UseGuards(AuthGuard) report(@Query() query: ReportQueryDto) {
    return this.reports.report(query);
  }
  @Get('admin/activity') @UseGuards(AuthGuard) activity(@Query() query: ReportQueryDto) {
    return this.reports.activity(query);
  }
  @Get('admin/orders/:id/payments') @UseGuards(AuthGuard) payments(
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.reports.ledger(id);
  }
  @Post('admin/orders/:id/payments') @UseGuards(AuthGuard) payment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: PaymentEventDto,
    @Req() request: AuthenticatedRequest
  ) {
    requireManager(request.admin);
    return this.reports.record(id, body, request.admin.id);
  }
  @Post('orders/quote') quote(@Body() body: QuoteOrderDto) {
    return this.orders.quote(body);
  }
  @Get('orders/options') options() {
    return this.orders.options();
  }
  @Post('orders') create(
    @Body() body: CreateOrderDto,
    @Headers('idempotency-key') key: string | undefined
  ) {
    return this.orders.create(body, key ?? '');
  }
  @Post('orders/track') track(@Body() body: TrackOrderDto, @Req() request: { ip: string }) {
    return this.orders.track(body, request.ip);
  }
  @Get('admin/orders') @UseGuards(AuthGuard) list(@Query() query: OrderQueryDto) {
    return this.orders.list(query);
  }
  @Get('admin/orders/:id') @UseGuards(AuthGuard) detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.orders.detail(id);
  }
  @Patch('admin/orders/:id/status') @UseGuards(AuthGuard) status(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateOrderStatusDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.orders.updateStatus(id, body.status, request.admin!.id);
  }
}
