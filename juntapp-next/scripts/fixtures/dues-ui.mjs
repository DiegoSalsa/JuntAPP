import { createServer } from 'node:http';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import * as visualData from './ux-ui-v2-data.mjs';

export const billingMonth = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit' }).format(new Date());
export function period(offset = 0) {
  const date = new Date(`${billingMonth}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 10);
}
const juntaId = '11111111-1111-4111-8111-111111111111';
const householdId = '44444444-4444-4444-8444-444444444444';
const newHouseholdId = '55555555-5555-4555-8555-555555555555';
const junta = { id: juntaId, name: 'Junta de prueba', slug: 'prueba', invite_code: 'PRUEBA', subscription_status: 'authorized', subscription_plan: 'juntapp', billing_mode: 'subscription', subscription_price: 19990, monthly_due_amount: 5000, owner_id: '33333333-3333-4333-8333-333333333333' };
const profiles = [
  { id: junta.owner_id, email: 'directiva@example.test', name: 'Directiva Prueba', role: 'dirigente', board_position: 'presidente', household_id: householdId, address: 'Avenida Los Pinos 123' },
  { id: '22222222-2222-4222-8222-222222222222', email: 'nuevo@example.test', name: 'Vecino Nuevo', role: 'vecino', board_position: null, household_id: newHouseholdId, address: 'Pasaje Las Flores 456' },
].map((profile) => ({ ...profile, junta_id: juntaId, membership_status: 'active', rut: '11111111-1', phone: null, cuota_status: 'pendiente', created_at: `${billingMonth}-15T12:00:00Z`, juntas: junta }));
const households = [
  { id: householdId, created_at: `${period(-6).slice(0, 7)}-15T12:00:00Z`, junta_id: juntaId },
  { id: newHouseholdId, created_at: `${billingMonth}-15T12:00:00Z`, junta_id: juntaId },
];
const manualId = '66666666-6666-4666-8666-666666666666';
const activeId = '77777777-7777-4777-8777-777777777777';
const batches = [
  { id: manualId, household_id: householdId, total_amount: 10000, status: 'approved', payment_source: 'manual', manual_payment_method: 'transfer', created_at: period(-4), confirmed_at: period(-4), mercadopago_payment_id: null, due_payment_batch_items: [-4, -3].map((offset) => ({ period: period(offset), amount: 5000 })) },
  { id: activeId, household_id: householdId, total_amount: 5000, status: 'preference_created', payment_source: null, checkout_expires_at: new Date(Date.now() - 60_000).toISOString(), created_at: period(-1), confirmed_at: null, mercadopago_payment_id: null, due_payment_batch_items: [{ period: period(-1), amount: 5000 }] },
];
const expiredAt = new Date(Date.now() - 60_000).toISOString();
const dues = [-5, -4, -3, -1].map((offset) => ({ id: `due-${offset}`, junta_id: juntaId, household_id: householdId, period: period(offset), amount: 5000, status: offset === -1 ? 'preference_created' : 'paid', payment_source: offset === -5 ? 'mercadopago' : offset === -1 ? null : 'manual', mercadopago_payment_id: offset === -5 ? 'old-mp-payment' : null, mercadopago_preference_id: offset === -1 ? 'old-preference' : null, checkout_expires_at: offset === -1 ? expiredAt : null, payment_batch_id: offset === -1 ? activeId : offset === -5 ? null : manualId }));
const tokenFor = (profile) => `${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: profile.id, email: profile.email, exp: 2000000000, role: 'authenticated' })).toString('base64url')}.mock`;

export async function startFixture({ serve = false, visual = false } = {}) {
  if (visual) junta.subscription_plan = 'juntapp_web';
  const mock = createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin ?? '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] ?? 'authorization, apikey, content-type, x-client-info, prefer, accept');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Content-Type', 'application/json');
    if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }
    const url = new URL(req.url, 'http://localhost');
    const bearer = req.headers.authorization?.replace(/^Bearer /, '');
    const current = profiles.find((profile) => tokenFor(profile) === bearer);
    if (url.pathname === '/auth/v1/token') {
      let raw = ''; for await (const chunk of req) raw += chunk;
      const input = req.headers['content-type']?.includes('application/json') ? JSON.parse(raw) : Object.fromEntries(new URLSearchParams(raw));
      const profile = profiles.find((candidate) => candidate.email === input.email) ?? profiles[0];
      if (!profile) { res.writeHead(400).end('{"message":"Invalid credentials"}'); return; }
      res.end(JSON.stringify({ access_token: tokenFor(profile), refresh_token: `refresh-${profile.id}`, token_type: 'bearer', expires_in: 3600, user: { id: profile.id, email: profile.email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: profile.created_at } })); return;
    }
    if (url.pathname === '/auth/v1/user') {
      if (!current) { res.writeHead(401).end('{"message":"Invalid JWT"}'); return; }
      res.end(JSON.stringify({ id: current.id, email: current.email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} })); return;
    }
    if (url.pathname.startsWith('/storage/v1/')) { res.end('[]'); return; }
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      if (!current && bearer !== 'mock-service-role') { res.writeHead(401).end('{"message":"Invalid JWT"}'); return; }
      const rpc = url.pathname.split('/').pop();
      let raw = ''; for await (const chunk of req) raw += chunk;
      const input = raw ? JSON.parse(raw) : {};
      if (visual && rpc === 'board_contacts') { res.end(JSON.stringify(profiles.filter(x => x.role === 'dirigente'))); return; }
      if (visual && rpc === 'poll_overview') { const overview = visualData.polls.flatMap((poll, pollIndex) => poll.options.map((x, i) => ({ poll_id: poll.id, option_id: x.id, votes: pollIndex === 0 ? [18, 12, 7][i] ?? 0 : [9, 6][i] ?? 0, has_voted: false }))); res.end(JSON.stringify(overview)); return; }
      if (visual && rpc === 'superadmin_member_counts') { res.end(JSON.stringify([{ junta_id: juntaId, members: 2, leaders: 1 }])); return; }
      if (visual && rpc === 'superadmin_due_summary') { res.end(JSON.stringify([{ collected: 180000 }])); return; }
      if (visual && rpc === 'superadmin_treasury_summary') { res.end(JSON.stringify([visualData.summary])); return; }
      if (visual && rpc === 'treasury_summary') { res.end(JSON.stringify([visualData.summary])); return; }
      if (visual && rpc === 'treasury_monthly_summary') { res.end(JSON.stringify(visualData.monthly)); return; }
      if (visual && rpc === 'treasury_expense_breakdown') { res.end(JSON.stringify([{ category: 'otros', amount: 42000 }, { category: 'comisiones', amount: 6500 }])); return; }
      if (rpc === 'junta_roster_page') {
        const search = String(input.p_search ?? '').toLowerCase();
        const due = String(input.p_due ?? '');
        let rows = profiles.slice();
        if (input.p_role) rows = rows.filter((profile) => profile.role === input.p_role);
        if (input.p_position) rows = rows.filter((profile) => profile.board_position === input.p_position);
        if (search) rows = rows.filter((profile) => [profile.name, profile.rut, profile.address].some((value) => value.toLowerCase().includes(search)));
        if (due === 'al_dia') rows = rows.filter((profile) => dues.some((item) => item.household_id === profile.household_id && item.status === 'paid' && item.period === input.p_period));
        if (due === 'pendiente') rows = rows.filter((profile) => !dues.some((item) => item.household_id === profile.household_id && item.status === 'paid' && item.period === input.p_period));
        const offset = Number(input.p_offset ?? 0); const limit = Number(input.p_limit ?? 50); const total = rows.length;
        res.end(JSON.stringify(rows.slice(offset, offset + limit).map((profile) => ({ ...profile, cuota_status: dues.some((item) => item.household_id === profile.household_id && item.status === 'paid' && item.period === input.p_period) ? 'al_dia' : 'pendiente', household_created_at: households.find((household) => household.id === profile.household_id)?.created_at ?? null, total_count: total })))); return;
      }
      if (rpc === 'junta_due_history') {
        const ids = input.p_household_ids ?? [];
        const matching = dues.filter((item) => ids.includes(item.household_id)).sort((a, b) => a.household_id.localeCompare(b.household_id) || b.period.localeCompare(a.period));
        const offset = Number(input.p_offset ?? 0); const limit = Math.min(Math.max(Number(input.p_limit ?? 200), 1), 200);
        res.end(JSON.stringify(matching.slice(offset, offset + limit).map((item) => ({ ...item, mercadopago_payment_id: undefined, total_count: matching.length })))); return;
      }
      if (rpc === 'junta_has_secretary') { res.end('false'); return; }
      if (rpc === 'junta_due_household_counts') {
        const total = households.length; const paid = households.filter((household) => dues.some((item) => item.household_id === household.id && item.period === input.p_period && item.status === 'paid')).length;
        res.end(JSON.stringify([{ total_households: total, paid_households: paid }])); return;
      }
      if (rpc === 'treasury_summary') { res.end(JSON.stringify([{ income: 0, expenses: 0, fees: 0, balance: 0 }])); return; }
      if (rpc === 'treasury_monthly_summary' || rpc === 'treasury_expense_breakdown') { res.end('[]'); return; }
      res.end('[]'); return;
    }
    if (url.pathname.startsWith('/rest/v1/')) {
      if (!current && bearer !== 'mock-service-role') { res.writeHead(401).end('{"message":"Invalid JWT"}'); return; }
      const table = url.pathname.split('/').pop();
      let rows = table === 'profiles' ? profiles : table === 'households' ? households : table === 'member_dues' ? dues : table === 'due_payment_batches' ? batches : table === 'mercadopago_junta_accounts' ? [{ mercadopago_user_id: '12345', connected_at: period() }] : table === 'board_contacts' ? [profiles[0]] : [];
      if (visual) {
        const tables = { announcements: visualData.announcements, polls: visualData.polls, poll_proposals: visualData.proposals, transactions: visualData.transactions, website_pages: [visualData.website], juntas: [{ ...junta, region: 'Región de prueba', comuna: 'Comuna de prueba', created_at: '2026-10-01T12:00:00Z' }] };
        if (tables[table]) rows = tables[table];
      }
      for (const [key, value] of url.searchParams) {
        if (value.startsWith('eq.')) rows = rows.filter((row) => String(row[key]) === value.slice(3));
      }
      res.setHeader('Content-Range', `0-${Math.max(0, rows.length - 1)}/${rows.length}`);
      if (url.searchParams.has('limit')) rows = rows.slice(0, Number(url.searchParams.get('limit')));
      if (req.method === 'HEAD') { res.end(); return; }
      res.end(JSON.stringify(req.headers.accept?.includes('application/vnd.pgrst.object+json') ? rows[0] ?? null : rows)); return;
    }
    res.writeHead(404).end('{"message":"Not found"}');
  });
  mock.listen(serve ? 42011 : 0, '127.0.0.1'); await once(mock, 'listening');
  const appPort = serve ? 42012 : 43000 + Math.floor(Math.random() * 10000);
  const appUrl = `http://127.0.0.1:${appPort}`;
  const app = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-H', '127.0.0.1', '-p', String(appPort)], { env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${mock.address().port}`, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'mock-anon-key', SUPABASE_SERVICE_ROLE_KEY: 'mock-service-role', SUPERADMIN_SESSION_SECRET: visualData.sessionSecret, NEXT_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = ''; app.stdout.on('data', (chunk) => { output += chunk; }); app.stderr.on('data', (chunk) => { output += chunk; });
  for (let attempt = 0; attempt < 90; attempt++) {
    try { if ((await fetch(`${appUrl}/login`)).ok) return { appUrl, stop: async () => { app.kill(); await once(app, 'close'); await new Promise((resolve) => mock.close(resolve)); } }; } catch { /* starting */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  app.kill(); mock.close(); throw new Error(`App did not start: ${output.slice(-2000)}`);
}
