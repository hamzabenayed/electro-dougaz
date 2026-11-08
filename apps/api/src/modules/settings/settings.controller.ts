import { Body, Controller, ForbiddenException, Get, Put, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { UpdateSettingsDto } from './settings.dto.js';
import { SettingsService } from './settings.service.js';

function requireOwner(request: AuthenticatedRequest) {
  if (request.admin?.role !== 'owner')
    throw new ForbiddenException('Accès réservé au propriétaire');
  return request.admin;
}

@Controller()
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}
  @Get('settings') publicSettings() {
    return this.settings.publicSettings();
  }
  @Get('admin/settings') @UseGuards(AuthGuard) get(@Req() request: AuthenticatedRequest) {
    requireOwner(request);
    return this.settings.get();
  }
  @Put('admin/settings') @UseGuards(AuthGuard) update(
    @Body() body: UpdateSettingsDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.settings.update(body, requireOwner(request).id);
  }
}
