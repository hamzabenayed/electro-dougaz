import { ForbiddenException } from '@nestjs/common';
import type { AuthenticatedAdmin } from './auth.types.js';
export function requireManager(
  admin: AuthenticatedAdmin | undefined
): asserts admin is AuthenticatedAdmin {
  if (!admin || !['owner', 'manager'].includes(admin.role))
    throw new ForbiddenException('Droits de gestion requis');
}
