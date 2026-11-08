import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { Pool } from 'pg';

config({ path: resolve(process.cwd(), '../../.env'), quiet: true });
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required');
}

const migrationsDirectory = resolve(
  process.cwd(),
  process.env.MIGRATIONS_DIR ?? '../../apps/shared/migrations'
);
const pool = new Pool({ connectionString: databaseUrl });

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const files = (await readdir(migrationsDirectory)).filter((file) => file.endsWith('.sql')).sort();

  for (const filename of files) {
    const applied = await pool.query<{ exists: boolean }>(
      'SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE filename = $1) AS exists',
      [filename]
    );
    if (applied.rows[0]?.exists) continue;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(await readFile(resolve(migrationsDirectory, filename), 'utf8'));
      await client.query('INSERT INTO schema_migrations(filename) VALUES ($1)', [filename]);
      await client.query('COMMIT');
      process.stdout.write(`Applied ${filename}\n`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
} finally {
  await pool.end();
}
