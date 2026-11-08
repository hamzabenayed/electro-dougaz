import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import type { AuthenticatedAdmin } from './auth.types.js';

export interface AuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
  admin?: AuthenticatedAdmin;
  accessToken?: string;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const value = Array.isArray(authorization) ? authorization[0] : authorization;
    if (!value?.startsWith('Bearer '))
      throw new UnauthorizedException('Jeton administrateur requis');
    const token = value.slice(7);
    request.admin = await this.auth.authenticate(token);
    request.accessToken = token;
    return true;
  }
}
