import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = path.resolve(root, '..', 'backend', 'supabase', 'migrations');
const psql = process.env.DUE_TEST_PSQL || 'psql';
const adminUrl = process.env.DUE_TEST_DATABASE_URL;

if (!adminUrl) {
  console.log('DUE_TEST_DB_RESULT=SKIPPED reason=missing_DUE_TEST_DATABASE_URL');
  process.exit(0);
}

const dbName = `juntapp_due_test_${Date.now()}`;
const parsedUrl = new URL(adminUrl);
parsedUrl.pathname = `/${dbName}`;
const databaseUrl = parsedUrl.toString();

function run(args, input = undefined, url = adminUrl) {
  const result = spawnSync(psql, ['--no-psqlrc', '--quiet', '--dbname', url, ...args], {
    cwd: root,
    input,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${result.stderr}\n${result.stdout}`);
  return result.stdout;
}

try {
  run(['-v', 'ON_ERROR_STOP=1', '-c', `CREATE DATABASE "${dbName}"`]);
  run(['-v', 'ON_ERROR_STOP=1', '-f', path.join(root, 'scripts', 'test-due-payment-batches-setup.sql')], undefined, databaseUrl);
  const migrations = fs.readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((file) => path.join(migrationsDir, file));
  for (const migration of migrations) run(['-v', 'ON_ERROR_STOP=1', '-1', '-f', migration], undefined, databaseUrl);
  const output = run(['-v', 'ON_ERROR_STOP=1', '-f', path.join(root, 'scripts', 'test-due-payment-batches.sql')], undefined, databaseUrl);
  assert.match(output, /due payment PostgreSQL integration checks passed/);
  console.log('DUE_TEST_DB_RESULT=PASSED isolated_database=true');
} finally {
  run(['-v', 'ON_ERROR_STOP=1', '-c', `DROP DATABASE IF EXISTS "${dbName}"`]);
}
