import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { currentChileBillingPeriodStart } from '../src/lib/billing-period.ts';
import { calculateTreasuryStats } from '../src/lib/treasury.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const inicio = read('src', 'app', '(dashboard)', 'inicio', 'page.tsx');
const tesoreria = read('src', 'app', '(dashboard)', 'tesoreria', 'page.tsx');
const socios = read('src', 'app', '(dashboard)', 'socios', 'page.tsx');
const consultas = read('src', 'app', '(dashboard)', 'consultas', 'page.tsx');
const builder = read('src', 'components', 'website', 'WebsiteBuilder.tsx');
const shell = read('src', 'components', 'original', 'OriginalDashboardShell.tsx');
const websiteDraftMigration = readFromRepo('backend', 'supabase', 'migrations', '20261012010000_website_draft_published_snapshot.sql');
const treasuryAggregatesMigration = readFromRepo('backend', 'supabase', 'migrations', '20261012020000_treasury_chart_aggregates.sql');
const rosterMigration = readFromRepo('backend', 'supabase', 'migrations', '20261012030000_roster_pagination_aggregates.sql');
const sociosClient = read('src', 'components', 'dashboard', 'socios', 'SociosClient.tsx');
const dashboardDbTest = read('scripts', 'test-due-payment-batches.sql');

function readFromRepo(...parts) {
 return fs.readFileSync(path.resolve(root, '..', ...parts), 'utf8');
}

assert.match(inicio, /rpc\('treasury_summary'/);
assert.match(inicio, /rpc\('junta_due_household_counts'/);
assert.match(inicio, /currentChileBillingPeriodStart/);
assert.match(inicio, /p_period: period/);
assert.doesNotMatch(inicio, /p_period: `\$\{period\}-01`/);
assert.doesNotMatch(inicio, /transactions.*limit\(1000\)/s);
assert.match(tesoreria, /count: 'exact'/);
assert.match(tesoreria, /rpc\('junta_due_household_counts'/);
assert.match(tesoreria, /\.range\(transactionFrom/);
assert.match(socios, /rpc\('junta_roster_page'/);
assert.match(socios, /p_offset: from/);
assert.doesNotMatch(socios, /\.from\('member_dues'\)\s*\n\s*\.select\('household_id'\)/);
assert.doesNotMatch(socios, /\.from\('households'\)\s*\n\s*\.select\('id, created_at'\)\s*\n\s*\.eq\('junta_id'/);
assert.match(sociosClient, /hasSecretary/);
assert.doesNotMatch(sociosClient, /useState\(initialSearch\)/);
assert.match(sociosClient, /const filtered = socios/);
assert.match(consultas, /rpc\('poll_overview'/);
assert.doesNotMatch(consultas, /Promise\.all\(\(polls \|\| \[\]\)\.map/);
assert.match(builder, /save\(mode: 'draft'\s*\|\s*'publish'\s*\|\s*'unpublish'/);
assert.match(builder, /draft_content/);
assert.match(builder, /draft_content:null/);
assert.match(websiteDraftMigration, /ADD COLUMN IF NOT EXISTS draft_content JSONB/);
assert.match(websiteDraftMigration, /ADD COLUMN IF NOT EXISTS draft_template TEXT/);
assert.match(websiteDraftMigration, /DROP POLICY IF EXISTS "Published websites are public"/);
assert.match(websiteDraftMigration, /REVOKE SELECT ON public\.website_pages FROM anon/);
assert.match(builder, /\? \{ junta_id:juntaId, \.\.\.draft, published,/);
assert.match(builder, /defaultToNull:false/);
assert.match(builder, /Despublicar/);
assert.match(shell, /count: 'exact'/);
assert.match(shell, /setUnreadCount\(count \?\? 0\)/);
assert.doesNotMatch(shell, /count \+ 1/);
assert.match(tesoreria, /rpc\('treasury_monthly_summary'/);
assert.match(tesoreria, /rpc\('treasury_expense_breakdown'/);
assert.match(treasuryAggregatesMigration, /CREATE OR REPLACE FUNCTION public\.treasury_monthly_summary/);
assert.match(treasuryAggregatesMigration, /CREATE OR REPLACE FUNCTION public\.treasury_expense_breakdown/);
assert.match(rosterMigration, /CREATE OR REPLACE FUNCTION public\.junta_roster_page/);
assert.match(rosterMigration, /CREATE OR REPLACE FUNCTION public\.junta_due_history/);
assert.match(rosterMigration, /CREATE OR REPLACE FUNCTION public\.junta_has_secretary/);
assert.match(dashboardDbTest, /generate_series\(1, 1205\)/);
assert.match(dashboardDbTest, /dashboard aggregate PostgreSQL integration checks passed/);

const period = currentChileBillingPeriodStart(new Date('2026-10-11T03:00:00Z'));
assert.equal(period, '2026-10-01', 'Inicio debe enviar una fecha PostgreSQL válida al RPC de cuotas');
assert.doesNotMatch(period, /-01-01$/);

const movements = Array.from({ length: 1_205 }, (_, index) => ({
  type: index % 4 === 0 ? 'egreso' : 'ingreso', amount: 1000, gross_amount: 1000,
  fee_amount: index % 4 === 0 ? 0 : 10, net_amount: index % 4 === 0 ? -1000 : 990,
  accounting_kind: index % 4 === 0 ? 'expense' : 'income',
}));
const allStats = calculateTreasuryStats(movements);
assert.equal(allStats.income, 903000, 'los reportes no deben truncarse en 50 filas');
assert.equal(allStats.expenses, 311030);
assert.equal(allStats.balance, 591970);
assert.notDeepEqual(calculateTreasuryStats(movements.slice(0, 50)), allStats, 'la página del libro no puede representar el reporte completo');

console.log('Dashboard audit contract tests passed.');
