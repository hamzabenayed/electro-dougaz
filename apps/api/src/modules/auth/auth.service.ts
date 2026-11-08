import { createHash, randomBytes } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import { verifyPassword } from './password.js';
import type { AdminRole, AuthenticatedAdmin } from './auth.types.js';

interface UserRow {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  role: AdminRole;
  is_active: boolean;
}
const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');

@Injectable()
export class AuthService {
  constructor(private readonly database: DatabaseService) {}

  async login(
    email: string,
    password: string
  ): Promise<{ token: string; expiresAt: string; user: AuthenticatedAdmin }> {
    const result = await this.database.query<UserRow>(
      'SELECT id, email, display_name, password_hash, role, is_active FROM admin_users WHERE email = lower($1)',
      [email.trim()]
    );
    const user = result.rows[0];
    if (!user || !user.is_active || !(await verifyPassword(password, user.password_hash)))
      throw new UnauthorizedException('Identifiants invalides');
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
    await this.database.query(
      'INSERT INTO admin_sessions(user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, tokenHash(token), expiresAt]
    );
    return {
      token,
      expiresAt: expiresAt.toISOString(),
      user: { id: user.id, email: user.email, displayName: user.display_name, role: user.role }
    };
  }

  async authenticate(token: string): Promise<AuthenticatedAdmin> {
    const result = await this.database.query<UserRow>(
      `SELECT u.id, u.email, u.display_name, u.role, u.is_active, '' AS password_hash FROM admin_sessions s JOIN admin_users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > now()`,
      [tokenHash(token)]
    );
    const user = result.rows[0];
    if (!user?.is_active) throw new UnauthorizedException('Session invalide ou expirée');
    await this.database.query(
      'UPDATE admin_sessions SET last_used_at = now() WHERE token_hash = $1',
      [tokenHash(token)]
    );
    return { id: user.id, email: user.email, displayName: user.display_name, role: user.role };
  }

  async logout(token: string): Promise<void> {
    await this.database.query('DELETE FROM admin_sessions WHERE token_hash = $1', [
      tokenHash(token)
    ]);
  }
}
