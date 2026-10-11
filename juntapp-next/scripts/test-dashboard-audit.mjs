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

assert.match(inicio, /rpc\('treasury_summary'/);
assert.doesNotMatch(inicio, /transactions.*limit\(1000\)/s);
assert.match(tesoreria, /count: 'exact'/);
assert.match(tesoreria, /\.range\(transactionFrom/);
assert.match(socios, /const from = \(page - 1\) \* pageSize/);
assert.match(socios, /\.range\(from/);
assert.match(socios, /name\.ilike/);
assert.match(consultas, /rpc\('poll_overview'/);
assert.doesNotMatch(consultas, /Promise\.all\(\(polls \|\| \[\]\)\.map/);
assert.match(builder, /save\(mode: 'draft'\s*\|\s*'publish'\s*\|\s*'unpublish'/);
assert.match(builder, /published\s*:\s*nextPublished/);
assert.match(builder, /Despublicar/);
assert.match(shell, /count: 'exact'/);
assert.match(shell, /setUnreadCount\(count \?\? 0\)/);

console.log('Dashboard audit contract tests passed.');
