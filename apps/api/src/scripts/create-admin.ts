import { Pool } from 'pg';
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { hashPassword } from '../modules/auth/password.js';

async function main(): Promise<void> {
  config({ path: resolve(process.cwd(), '../../.env'), quiet: true });
  const databaseUrl = process.env.DATABASE_URL;
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const displayName = process.env.ADMIN_DISPLAY_NAME?.trim() || 'Administrateur';
  if (!databaseUrl || !email || !password)
    throw new Error('DATABASE_URL, ADMIN_EMAIL and ADMIN_PASSWORD are required');
  if (password.length < 12) throw new Error('ADMIN_PASSWORD must contain at least 12 characters');
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const passwordHash = await hashPassword(password);
    await pool.query(
      `INSERT INTO admin_users(email,display_name,password_hash,role) VALUES ($1,$2,$3,'owner') ON CONFLICT(email) DO UPDATE SET display_name=excluded.display_name,password_hash=excluded.password_hash,is_active=true,updated_at=now()`,
      [email, displayName, passwordHash]
    );
    process.stdout.write(`Admin account ready for ${email}\n`);
  } finally {
    await pool.end();
  }
}

void main();
