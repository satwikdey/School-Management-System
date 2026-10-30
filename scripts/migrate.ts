import fs from 'fs';
import path from 'path';
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function runMigrations() {
  const databaseUrl =
    process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS public._v2_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const migrationsDir = path.resolve(__dirname, '../supabase/migrations');
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    console.log(`Checking ${files.length} SQL migration(s)...`);
    for (const file of files) {
      const { rowCount } = await client.query(
        'SELECT 1 FROM public._v2_migrations WHERE filename = $1',
        [file]
      );
      if (rowCount && rowCount > 0) {
        console.log(` -> Skipping ${file} (already applied)`);
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      console.log(` -> Executing ${file}`);
      try {
        await client.query(sql);
      } catch (err: any) {
        // 42710 = duplicate_object (e.g., policy already exists from prior run before tracking table)
        if (err?.code !== '42710') {
          throw err;
        }
      }
      await client.query(
        'INSERT INTO public._v2_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING',
        [file]
      );
    }
    console.log('All SQL migrations applied successfully.');
  } finally {
    await client.end();
  }
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
