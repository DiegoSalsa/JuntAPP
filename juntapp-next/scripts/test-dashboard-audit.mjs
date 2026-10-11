import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const inicio = read('src', 'app', '(dashboard)', 'inicio', 'page.tsx');
const tesoreria = read('src', 'app', '(dashboard)', 'tesoreria', 'page.tsx');
const socios = read('src', 'app', '(dashboard)', 'socios', 'page.tsx');
const consultas = read('src', 'app', '(dashboard)', 'consultas', 'page.tsx');
const builder = read('src', 'components', 'website', 'WebsiteBuilder.tsx');
const shell = read('src', 'components', 'original', 'OriginalDashboardShell.tsx');
const websiteDraftMigration = readFromRepo('backend', 'supabase', 'migrations', '20261012010000_website_draft_published_snapshot.sql');

function readFromRepo(...parts) {
 return fs.readFileSync(path.resolve(root, '..', ...parts), 'utf8');
}

assert.match(inicio, /rpc\('treasury_summary'/);
assert.match(inicio, /rpc\('junta_due_household_counts'/);
assert.doesNotMatch(inicio, /transactions.*limit\(1000\)/s);
assert.match(tesoreria, /count: 'exact'/);
assert.match(tesoreria, /rpc\('junta_due_household_counts'/);
assert.match(tesoreria, /\.range\(transactionFrom/);
assert.match(socios, /const from = \(page - 1\) \* pageSize/);
assert.match(socios, /\.range\(from/);
assert.match(socios, /name\.ilike/);
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

console.log('Dashboard audit contract tests passed.');
