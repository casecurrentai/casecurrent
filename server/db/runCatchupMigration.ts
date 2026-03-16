/**
 * Catch-up migration runner.
 *
 * Executes the catch-up SQL migration directly via Prisma's raw query API.
 * This is idempotent — all statements use IF NOT EXISTS / conditional DO blocks.
 *
 * Called once at server startup before routes are registered. Failures are
 * logged but non-fatal so the server still boots for non-dashboard routes.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import type { PrismaClient } from '../../apps/api/src/generated/prisma';

const MIGRATION_FILES = [
  path.resolve(
    process.cwd(),
    'apps/api/prisma/migrations/20260305000000_catchup_schema_drift/migration.sql',
  ),
  path.resolve(
    process.cwd(),
    'apps/api/prisma/migrations/20260306000000_call_artifact_cache/migration.sql',
  ),
];

/**
 * Split a multi-statement SQL file into individual statements, stripping
 * comments and empty lines, then execute each one.
 *
 * DO $$ ... $$ blocks are kept as a single unit (they contain semicolons inside).
 */
function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inDollarBlock = false;

  for (const line of sql.split('\n')) {
    const stripped = line.trim();

    // Skip pure comment lines and blanks
    if (!inDollarBlock && (stripped.startsWith('--') || stripped === '')) {
      continue;
    }

    current += line + '\n';

    // Track DO $$ ... $$ blocks
    if (stripped.startsWith('DO $$') || stripped === 'DO $$') {
      inDollarBlock = true;
    }
    if (inDollarBlock && stripped === '$$;') {
      inDollarBlock = false;
      statements.push(current.trim());
      current = '';
      continue;
    }

    // Normal statement ends with semicolon (outside a DO block)
    if (!inDollarBlock && stripped.endsWith(';')) {
      statements.push(current.trim());
      current = '';
    }
  }

  if (current.trim()) {
    statements.push(current.trim());
  }

  return statements.filter(Boolean);
}

export async function runCatchupMigration(prisma: PrismaClient): Promise<void> {
  const correlationId = crypto.randomUUID().slice(0, 8);
  const tag = `[CATCHUP_MIGRATION cid=${correlationId}]`;

  let totalApplied = 0;
  let totalSkipped = 0;

  for (const MIGRATION_FILE of MIGRATION_FILES) {
    if (!fs.existsSync(MIGRATION_FILE)) {
      console.warn(`${tag} Migration file not found — skipping. path=${MIGRATION_FILE}`);
      continue;
    }

    const sql = fs.readFileSync(MIGRATION_FILE, 'utf-8');
    const statements = splitStatements(sql);
    const fileName = path.basename(path.dirname(MIGRATION_FILE));

    console.log(`${tag} Running migration "${fileName}": ${statements.length} statements`);

    let applied = 0;
    let skipped = 0;

    for (const stmt of statements) {
      try {
        await prisma.$executeRawUnsafe(stmt);
        applied++;
      } catch (err: any) {
        // Postgres error 42701 = duplicate_column (column already exists without IF NOT EXISTS support)
        // Postgres error 42P07 = duplicate_table
        // Postgres error 42710 = duplicate_object (index already exists)
        const code = err?.code || '';
        if (['42701', '42P07', '42710'].includes(code)) {
          skipped++;
        } else {
          const stmtPreview = stmt.slice(0, 120).replace(/\n/g, ' ');
          console.error(`${tag} Statement failed code=${code} file="${fileName}" stmt="${stmtPreview}" err=${err?.message}`);
          throw err;
        }
      }
    }

    console.log(`${tag} Migration "${fileName}" complete: applied=${applied} skipped=${skipped}`);
    totalApplied += applied;
    totalSkipped += skipped;
  }

  console.log(`${tag} All catch-up migrations complete: totalApplied=${totalApplied} totalSkipped=${totalSkipped}`);
}
