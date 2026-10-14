import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const { canReviewMembershipApplications } = await import('../src/lib/membership-review.ts');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const inicioPage = read('src', 'app', '(dashboard)', 'inicio', 'page.tsx');
const membershipReview = read('src', 'lib', 'membership-review.ts');
const inicio = read('src', 'components', 'dashboard', 'inicio', 'InicioV2.tsx');
const alerts = read('src', 'components', 'dashboard', 'inicio', 'InicioAlerts.tsx');
const polls = read('src', 'components', 'dashboard', 'votaciones', 'VotacionesClient.tsx');
const shell = read('src', 'components', 'original', 'OriginalDashboardShell.tsx');
const fixture = read('scripts', 'fixtures', 'ux-ui-v2-data.mjs');
const fixtureServer = read('scripts', 'fixtures', 'dues-ui.mjs');
const socios = read('src', 'components', 'dashboard', 'socios', 'SociosClient.tsx');
const builder = read('src', 'components', 'website', 'WebsiteBuilder.tsx');
const treasury = read('src', 'components', 'dashboard', 'tesoreria', 'TesoreriaClient.tsx');

// Dashboard indicators: errors and multiple rows must remain distinguishable from real zeroes.
assert.match(inicioPage, /profile\?\.role === 'dirigente'/);
assert.ok(inicioPage.indexOf("select('id', { count: 'exact'") > inicioPage.indexOf("profile?.role === 'dirigente'"), 'profile count must be role-gated');
assert.match(inicioPage, /\.select\('id, title'\)[\s\S]*\.limit\(3\)/);
const activePollQuery = inicioPage.slice(inicioPage.indexOf("supabase.from('polls')"), inicioPage.indexOf("supabase.from('polls')") + 260);
assert.doesNotMatch(activePollQuery, /maybeSingle/);
assert.match(inicioPage, /select\('id', \{ count: 'exact', head: true \}\)\.eq\('junta_id', juntaId\)\.eq\('active', true\)/);
assert.match(inicioPage, /activePollsCount/);
assert.match(inicioPage, /supabase\.rpc\('junta_has_secretary'\)/);
assert.match(inicioPage, /!hasSecretaryError[\s\S]*canReviewMembershipApplications\(profile, Boolean\(hasSecretary\)/);
assert.match(membershipReview, /if \(member\.role !== 'dirigente'\) return false/);
assert.match(membershipReview, /return !hasSecretary[\s\S]*member\.board_position === 'presidente'/);
assert.equal(canReviewMembershipApplications({ id: 'president', role: 'dirigente', board_position: 'presidente' }, true, 'owner'), false, 'active Secretary blocks President');
assert.equal(canReviewMembershipApplications({ id: 'president', role: 'dirigente', board_position: 'presidente' }, false, 'owner'), true, 'President can review without Secretary');
assert.equal(canReviewMembershipApplications({ id: 'secretary', role: 'dirigente', board_position: 'secretario' }, true, 'owner'), true, 'Secretary can review with active Secretary');
assert.equal(canReviewMembershipApplications({ id: 'treasurer', role: 'dirigente', board_position: 'tesorero' }, false, 'owner'), false, 'Other dirigente cannot review');
assert.match(inicio, /Domicilios registrados/);
assert.match(inicio, /Sin información/);
assert.match(inicio, /activePollsError/);
assert.match(inicio, /activePollsCount/);
assert.match(inicio, /canReviewApplications/);

// Execute the real server page and render its home component with synthetic
// Supabase responses. Only external I/O, Next Link and PWA setup are replaced.
const require = createRequire(import.meta.url);
function loadSource(source, filename, replacements = {}) {
  const compiled = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const compiledModule = { exports: {} };
  const resolve = (name) => Object.hasOwn(replacements, name) ? replacements[name] : require(name);
  new Function('require', 'module', 'exports', compiled)(resolve, compiledModule, compiledModule.exports);
  return compiledModule.exports;
}
const Home = loadSource(inicio, 'InicioV2.tsx', {
  'next/link': ({ children, ...props }) => createElement('a', props, children),
  './InicioAlerts': () => null,
  '@/lib/board': loadSource(read('src', 'lib', 'board.ts'), 'board.ts'),
  '@/lib/utils': loadSource(read('src', 'lib', 'utils.ts'), 'utils.ts'),
}).default;
let currentClient;
const Page = loadSource(inicioPage, 'page.tsx', {
  '@/lib/billing-period': { currentChileBillingPeriodStart: () => '2026-10-01' },
  '@/lib/supabase/server': { createClient: async () => currentClient },
  '@/components/dashboard/inicio/InicioV2': Home,
  '@/lib/membership-review': { canReviewMembershipApplications },
}).default;

async function homeScenario({ role = 'dirigente', position = 'presidente', id = 'president', hasSecretary = false, secretaryError = null, count = 5, pollError = null, countError = null, missingCount = false } = {}) {
  const profile = { id, role, board_position: position, name: 'Persona de prueba', junta_id: 'junta-test', household_id: 'home-test', juntas: { name: 'Junta de prueba', owner_id: 'owner' } };
  const activeRows = Array.from({ length: count }, (_, index) => ({ id: `poll-${index}`, title: `Consulta ${index + 1}`, active: true, junta_id: 'junta-test' }));
  const rowsByTable = {
    profiles: [profile], member_dues: [], announcements: [], membership_applications: [], poll_proposals: [],
    polls: [...activeRows, { id: 'closed', title: 'Cerrada', active: false, junta_id: 'junta-test' }, { id: 'foreign', title: 'Otra junta', active: true, junta_id: 'other-junta' }],
  };
  const queries = [];
  const rpcs = [];
  currentClient = {
    auth: { getUser: async () => ({ data: { user: { id } } }) },
    rpc: async (name) => {
      rpcs.push(name);
      if (name === 'junta_has_secretary') return { data: hasSecretary, error: secretaryError };
      return { data: [], error: null };
    },
    from(table) {
      assert.ok(Object.hasOwn(rowsByTable, table), `unexpected query: ${table}`);
      const query = { table, filters: [], columns: null, options: {}, limit: null };
      queries.push(query);
      const result = (single = false) => {
        const filtered = rowsByTable[table].filter((row) => query.filters.every(([field, value]) => row[field] === value));
        const error = table === 'polls' ? query.options.head ? countError : pollError : null;
        return { data: error || query.options.head ? null : single ? filtered[0] ?? null : query.limit == null ? filtered : filtered.slice(0, query.limit), count: query.options.count === 'exact' && !error && !(table === 'polls' && missingCount) ? filtered.length : null, error };
      };
      const builder = {
        select(columns, options = {}) { query.columns = columns; query.options = options; return this; },
        eq(field, value) { query.filters.push([field, value]); return this; },
        order() { return this; },
        limit(value) { query.limit = value; return this; },
        single() { return Promise.resolve(result(true)); },
        maybeSingle() { return Promise.resolve(result(true)); },
        then(resolve, reject) { return Promise.resolve(result()).then(resolve, reject); },
      };
      return builder;
    },
  };
  const element = await Page();
  const props = element.props;
  const html = renderToStaticMarkup(element);
  const pollQueries = queries.filter((query) => query.table === 'polls');
  assert.equal(pollQueries.length, 2);
  for (const query of pollQueries) {
    assert.ok(query.filters.some(([field, value]) => field === 'junta_id' && value === profile.junta_id));
    assert.ok(query.filters.some(([field, value]) => field === 'active' && value === true));
  }
  assert.equal(pollQueries.find((query) => !query.options.head).limit, 3);
  assert.equal(pollQueries.find((query) => query.options.head).options.count, 'exact');
  assert.deepEqual(pollQueries.map((query) => query.columns), ['id, title', 'id'], 'home does not request ballots or voter identities');
  return { props, html, rpcs };
}

for (const [name, options, expected] of [
  ['President with Secretary', { hasSecretary: true }, false],
  ['President without Secretary', { hasSecretary: false }, true],
  ['Secretary', { id: 'secretary', position: 'secretario', hasSecretary: true }, true],
  ['Owner with Secretary', { id: 'owner', position: 'tesorero', hasSecretary: true }, false],
  ['Owner without Secretary', { id: 'owner', position: 'tesorero' }, true],
  ['Other dirigente', { id: 'treasurer', position: 'tesorero' }, false],
  ['Neighbor owner', { id: 'owner', role: 'vecino', position: null }, false],
  ['Secretary lookup error', { secretaryError: { message: 'fixture failure' } }, false],
  ['Secretary with lookup error', { position: 'secretario', secretaryError: { message: 'fixture failure' } }, false],
  ['Secretary state unknown', { hasSecretary: null }, false],
]) {
  const { props, html, rpcs } = await homeScenario(options);
  assert.equal(props.canReviewApplications, expected, name);
  assert.equal(html.includes('Solicitudes de ingreso'), expected, name);
  assert.equal(rpcs.includes('junta_has_secretary'), options.role !== 'vecino', name);
}

for (const count of [0, 1, 2, 5]) {
  for (const role of ['dirigente', 'vecino']) {
    const { props, html } = await homeScenario({ count, role });
    assert.equal(props.activePollsCount, count);
    assert.equal(props.activePolls.length, Math.min(count, 3));
    assert.equal(props.activePollsError, false);
    if (role === 'dirigente') assert.match(html, new RegExp(`home-v2-task-count">${count}</span><span><b>Consultas activas`));
    else if (count === 0) assert.match(html, /Tu voz cuenta en la junta/);
    else if (count === 1) assert.match(html, /Hay una consulta abierta/);
    else assert.match(html, new RegExp(`Hay consultas abiertas[\\s\\S]*${count} disponibles`));
    assert.doesNotMatch(html, /Otra junta|Cerrada/);
  }
}
for (const failure of [{ pollError: { message: 'fixture failure' } }, { countError: { message: 'fixture failure' } }, { missingCount: true }]) {
  for (const role of ['dirigente', 'vecino']) {
    const { props, html } = await homeScenario({ ...failure, role });
    assert.equal(props.activePollsCount, null);
    assert.equal(props.activePollsError, true);
    if (role === 'dirigente') assert.match(html, /home-v2-task-count">—<\/span><span><b>Consultas activas/);
    else assert.match(html, /Consultas no disponibles[\s\S]*Reintentar en Consultas/);
  }
}
console.log('PASS Inicio rendered permission scenarios with/without Secretary, owner, other roles and lookup errors');
console.log('PASS Inicio rendered exact poll counts 0/1/2/5, three highlights, tenant scope and query errors');

// Compact PWA setup keeps installation and push actions available on demand.
assert.match(alerts, /detailsOpen/);
assert.match(alerts, /details-compact/);
assert.match(alerts, /Ver opciones/);

// Multiple active consultations are rendered independently and submit the selected poll id.
assert.match(polls, /const activePolls = polls\.filter\(\(poll\) => poll\.active\)/);
assert.match(polls, /selectedByPoll/);
assert.match(polls, /handleVote\(event, poll\)/);
assert.match(polls, /active-polls-stack/);
assert.match(fixture, /poll-fixture-2/);
assert.match(fixtureServer, /visualData\.polls\.flatMap/);

// UX structures remain semantic and mobile-safe.
assert.match(shell, /mobile-primary-nav|mobile-navigation-menu/);
assert.match(socios, /roster-workspace/);
assert.match(treasury, /ledger-mobile-list/);
assert.match(builder, /role="tablist"/);
assert.match(builder, /aria-selected/);

console.log('PASS UX/UI V2 regression contracts');
console.log('PASS indicator error states and role-aware actions');
console.log('PASS multiple active consultations fixture and rendering contract');
console.log('PASS mobile roster, ledger, dialogs and website builder contracts');
