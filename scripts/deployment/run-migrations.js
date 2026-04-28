#!/usr/bin/env node
// Runs all SQL files in backend/prisma/manual-migrations/ via prisma db execute.
// Every SQL file must be idempotent (IF NOT EXISTS / ON CONFLICT guards).

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('[migrations] DATABASE_URL is not set');
  process.exit(1);
}

const BACKEND_DIR = path.join(__dirname, '../../backend');
const MIGRATION_DIR = path.join(BACKEND_DIR, 'prisma/manual-migrations');

if (!fs.existsSync(MIGRATION_DIR)) {
  console.log('[migrations] no migration directory, skipping');
  process.exit(0);
}

const files = fs.readdirSync(MIGRATION_DIR)
  .filter(f => f.endsWith('.sql'))
  .sort();

if (files.length === 0) {
  console.log('[migrations] no SQL files, skipping');
  process.exit(0);
}

for (const file of files) {
  console.log(`[migrations] applying: ${file}`);
  execSync(
    `npx prisma db execute --file "${path.join(MIGRATION_DIR, file)}" --url "${DATABASE_URL}"`,
    { cwd: BACKEND_DIR, stdio: 'inherit' }
  );
  console.log(`[migrations] done: ${file}`);
}

console.log('[migrations] all migrations complete');
