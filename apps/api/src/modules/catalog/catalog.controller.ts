import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
  Delete,
  Res
} from '@nestjs/common';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { requireManager } from '../auth/authorization.js';
import {
  CatalogQueryDto,
  CreateCategoryDto,
  CreateProductDto,
  UpdateProductDto,
  ProductImageDto,
  PromotionScheduleDto,
  AccessoriesDto
} from './catalog.dto.js';
import { CatalogService } from './catalog.service.js';
import { MediaService } from './media.service.js';
import type { FastifyReply } from 'fastify';

@Controller()
export class CatalogController {
  @Get('admin/products/:id/accessories')
  @UseGuards(AuthGuard)
  accessories(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.accessories(id);
  }
  @Put('admin/products/:id/accessories')
  @UseGuards(AuthGuard)
  saveAccessories(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AccessoriesDto,
    @Req() request: AuthenticatedRequest
  ) {
    requireManager(request.admin);
    return this.catalog.saveAccessories(id, body.ids, request.admin.id);
  }
  @Get('products/:slug/accessories')
  publicAccessories(@Param('slug') slug: string) {
    return this.catalog.publicAccessories(slug);
  }
  @Put('admin/products/:id/promotion-schedule')
  @UseGuards(AuthGuard)
  schedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: PromotionScheduleDto,
    @Req() request: AuthenticatedRequest
  ) {
    requireManager(request.admin);
    return this.catalog.schedule(id, body.startsAt, body.endsAt, request.admin.id);
  }
  constructor(
    private readonly catalog: CatalogService,
    private readonly media: MediaService
  ) {}
  @Post('admin/products/:id/images')
  @UseGuards(AuthGuard)
  upload(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ProductImageDto,
    @Req() request: AuthenticatedRequest
  ) {
    requireManager(request.admin);
    return this.media.upload(id, body, request.admin.id);
  }
  @Delete('admin/products/:id/images/:imageId')
  @UseGuards(AuthGuard)
  removeImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
    @Req() request: AuthenticatedRequest
  ) {
    requireManager(request.admin);
    return this.media.remove(id, imageId, request.admin.id);
  }
  @Get('media/:id') async image(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() response: FastifyReply
  ) {
    const bytes = await this.media.read(id);
    response
      .header('Content-Type', 'image/webp')
      // The public shop and API can live on different origins (Netlify / Render).
      // Set this only after read() has checked product/category visibility.
      .header('Cross-Origin-Resource-Policy', 'cross-origin')
      .header('Cache-Control', 'no-store')
      .header('X-Content-Type-Options', 'nosniff');
    return response.send(bytes);
  }
  @Get('admin/media/:id') @UseGuards(AuthGuard) async adminImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() response: FastifyReply
  ) {
    const bytes = await this.media.read(id, true);
    response.header('Content-Type', 'image/webp').header('Cache-Control', 'private, no-store');
    return response.send(bytes);
  }
  @Get('categories') categories() {
    return this.catalog.categories();
  }
  @Get('products') products(@Query() query: CatalogQueryDto) {
    return this.catalog.publicProducts(query);
  }
  @Get('products/:slug') product(@Param('slug') slug: string) {
    return this.catalog.publicProduct(slug);
  }
  @Get('admin/categories') @UseGuards(AuthGuard) adminCategories() {
    return this.catalog.categories(true);
  }
  @Post('admin/categories') @UseGuards(AuthGuard) createCategory(
    @Body() body: CreateCategoryDto,
    @Req() request: AuthenticatedRequest
  ) {
    requireManager(request.admin);
    return this.catalog.createCategory(body);
  }
  @Get('admin/products') @UseGuards(AuthGuard) adminProducts(@Query() query: CatalogQueryDto) {
    return this.catalog.adminProducts(query);
  }
  @Get('admin/products/:id') @UseGuards(AuthGuard) adminProduct(
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.catalog.adminProduct(id);
  }
  @Post('admin/products') @UseGuards(AuthGuard) createProduct(
    @Body() body: CreateProductDto,
    @Req() request: AuthenticatedRequest
  ) {
    requireManager(request.admin);
    return this.catalog.createProduct(body, request.admin.id);
  }
  @Put('admin/products/:id') @UseGuards(AuthGuard) updateProduct(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateProductDto,
    @Req() request: AuthenticatedRequest
  ) {
    requireManager(request.admin);
    return this.catalog.updateProduct(id, body, request.admin.id);
  }
}
