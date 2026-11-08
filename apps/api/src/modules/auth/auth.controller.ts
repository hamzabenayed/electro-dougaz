import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, type AuthenticatedRequest } from './auth.guard.js';
import { LoginDto } from './auth.dto.js';
import { AuthService } from './auth.service.js';

@Controller('admin/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Post('login') @HttpCode(200) login(@Body() body: LoginDto) {
    return this.auth.login(body.email, body.password);
  }
  @Get('me') @UseGuards(AuthGuard) me(@Req() request: AuthenticatedRequest) {
    return request.admin;
  }
  @Post('logout') @HttpCode(204) @UseGuards(AuthGuard) async logout(
    @Req() request: AuthenticatedRequest
  ): Promise<void> {
    if (request.accessToken) await this.auth.logout(request.accessToken);
  }
}
