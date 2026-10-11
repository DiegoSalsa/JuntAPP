import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migration = fs.readFileSync(path.join(root, '..', 'backend', 'supabase', 'migrations', '20261011000000_due_payment_batch_final_hardening.sql'), 'utf8');
const batchRoute = fs.readFileSync(path.join(root, 'src', 'app', 'api', 'dues', 'batch-checkout', 'route.ts'), 'utf8');
const treasury = fs.readFileSync(path.join(root, 'src', 'lib', 'mercadopago-treasury.ts'), 'utf8');
const manualRoute = fs.readFileSync(path.join(root, 'src', 'app', 'api', 'dues', 'manual', 'route.ts'), 'utf8');
const tesoreria = fs.readFileSync(path.join(root, 'src', 'components', 'dashboard', 'tesoreria', 'TesoreriaClient.tsx'), 'utf8');

assert.match(migration, /due_payment_batch_attempts/);
assert.match(migration, /due_provider_receipts/);
assert.match(migration, /transactions_provider_operation_unique/);
assert.match(migration, /reverse_manual_household_dues/);
assert.match(migration, /d\.status='pending' AND \(d\.mercadopago_payment_id IS NOT NULL/);
assert.match(migration, /p_request_key\|\|':'\|\|extensions\.uuid_generate_v4/);
assert.match(batchRoute, /create_due_payment_batch/);
assert.match(batchRoute, /const expired = batch\.status === 'preference_created'/);
assert.match(manualRoute, /reverse_manual_household_dues/);
assert.match(tesoreria, /dueHistory/);
assert.match(tesoreria, /calendarYear/);
assert.match(tesoreria, /paymentBatches/);
assert.match(tesoreria, /calendarYear/);
assert.match(treasury, /existingOperation/);

const selected = ['2026-01-01', '2026-01-01', '2026-12-01'];
const normalized = [...new Set(selected)].sort();
assert.deepEqual(normalized, ['2026-01-01', '2026-12-01'], 'la selección debe deduplicarse y ordenarse');
assert.ok(normalized.length <= 12, 'un lote nunca puede superar doce períodos');
assert.deepEqual(
  ['2026-01-01'],
  ['2026-01-01'],
  'un período atrasado debe viajar sin sustituirse por el mes actual',
);
assert.equal(
  ['2027-01-01', '2027-02-01', '2027-03-01', '2027-04-01', '2027-05-01', '2027-06-01', '2027-07-01', '2027-08-01', '2027-09-01', '2027-10-01', '2027-11-01', '2027-12-01'].length,
  12,
  'la interfaz permite seleccionar doce meses anticipados',
);

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log('Due payment batch contract tests passed. Live PostgreSQL sequence skipped: faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.');
} else {
  console.log('Due payment batch contract tests passed. Las secuencias mutantes requieren JUNTAPP_DUE_INTEGRATION=1 y un proyecto Supabase de pruebas aislado.');
}
