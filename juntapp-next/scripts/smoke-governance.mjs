import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { createClient } from '@supabase/supabase-js';

function readEnv(file) {
  return Object.fromEntries(fs.readFileSync(file, 'utf8').split(/\r?\n/).filter((line) => line && !line.startsWith('#') && line.includes('=')).map((line) => {
    const index = line.indexOf('=');
    return [line.slice(0, index), line.slice(index + 1)];
  }));
}
function assert(condition, message) { if (!condition) throw new Error(message); }
function rutFrom(seed) {
  const body = String(10_000_000 + (seed % 8_000_000));
  let multiplier = 2; let sum = 0;
  for (let index = body.length - 1; index >= 0; index -= 1) { sum += Number(body[index]) * multiplier; multiplier = multiplier === 7 ? 2 : multiplier + 1; }
  const result = 11 - (sum % 11);
  return `${body}${result === 11 ? '0' : result === 10 ? 'K' : result}`;
}

const env = readEnv(path.resolve('.env.local'));
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const stamp = Date.now();
const password = 'TemporaryTest987!';
const address = `Pasaje Prueba Integración ${stamp}`;
const users = [];
let juntaId;
let browser;

async function createUser(label, rut, metadata) {
  const email = `codex-${label}-${stamp}@example.com`;
  if (metadata.junta_action === 'join') { const { data: junta } = await admin.from('juntas').select('id').eq('invite_code', metadata.invite_code).single(); const { error: inviteError } = await admin.from('member_invitations').insert({ junta_id: junta.id, email, rut }); if (inviteError) throw inviteError; }
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name: `Prueba ${label}`, rut, address, phone: '+56 9 1234 5678', ...metadata } });
  if (error) throw error;
  users.push(data.user.id);
  return { id: data.user.id, email };
}
async function login(page, email) {
  await page.goto('http://localhost:3000/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await page.waitForURL('**/inicio');
}

try {
  const president = await createUser('presidencia', rutFrom(stamp), { junta_action: 'create', junta_name: `Junta Integración ${stamp}`, junta_region: 'Valparaíso', junta_comuna: 'Valparaíso' });
  const { data: presidentProfile } = await admin.from('profiles').select('junta_id').eq('id', president.id).single();
  juntaId = presidentProfile.junta_id;
  await admin.from('juntas').update({ subscription_status: 'authorized', activated_at: new Date().toISOString() }).eq('id', juntaId);
  const { data: junta } = await admin.from('juntas').select('invite_code').eq('id', juntaId).single();

  const secretary = await createUser('secretaria', rutFrom(stamp + 1), { junta_action: 'join', invite_code: junta.invite_code });
  const { error: secretaryError } = await admin.from('profiles').update({ role: 'dirigente', board_position: 'secretario' }).eq('id', secretary.id);
  if (secretaryError) throw secretaryError;

  const applicantRut = rutFrom(stamp + 2);
  const applicantEmail = `codex-solicitante-${stamp}@mailinator.com`;
  const request = await fetch('http://localhost:3000/api/registration/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Prueba Solicitante', rut: applicantRut, address, phone: '+56 9 8765 4321', email: applicantEmail, inviteCode: junta.invite_code }) });
  const requestResult = await request.json();
  assert(request.status === 201, `Solicitud no creada: ${JSON.stringify(requestResult)}`);
  const { data: beforeApproval } = await admin.from('profiles').select('id').eq('email', applicantEmail).maybeSingle();
  assert(!beforeApproval, 'La solicitud creó acceso antes de la aprobación de Secretaría');

  browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' });
  let page = await browser.newPage();
  await login(page, secretary.email);
  const approval = await page.evaluate(async (applicationId) => {
    const response = await fetch(`/api/registration/applications/${applicationId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision: 'approve' }) });
    return { status: response.status, body: await response.json() };
  }, requestResult.applicationId);
  assert(approval.status === 200, `Secretaría no pudo aprobar: ${JSON.stringify(approval.body)}`);
  const { data: applicantProfile } = await admin.from('profiles').select('id, household_id').eq('email', applicantEmail).single();
  users.push(applicantProfile.id);
  await admin.auth.admin.updateUserById(applicantProfile.id, { password, email_confirm: true });

  const secondMember = await createUser('segundo-socio', rutFrom(stamp + 3), { junta_action: 'join', invite_code: junta.invite_code });
  const { data: secondProfile } = await admin.from('profiles').select('household_id').eq('id', secondMember.id).single();
  assert(applicantProfile.household_id === secondProfile.household_id, 'La misma dirección no fue agrupada en un único domicilio');
  const { error: dueError } = await admin.rpc('set_manual_household_due', { p_household_id: applicantProfile.household_id, p_junta_id: juntaId, p_action: 'paid', p_method: 'transfer' });
  if (dueError) throw dueError;
  const period = `${new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit' }).format(new Date()).slice(0, 7)}-01`;
  const [{ data: householdDues }, { data: householdMembers }] = await Promise.all([
    admin.from('member_dues').select('id').eq('household_id', applicantProfile.household_id).eq('period', period),
    admin.from('profiles').select('cuota_status').eq('household_id', applicantProfile.household_id),
  ]);
  assert(householdDues.length === 1, 'Se generó más de una cuota para el mismo domicilio');
  assert(householdMembers.every((member) => member.cuota_status === 'al_dia'), 'El pago no dejó al día a todos los socios del domicilio');

  await page.close();
  page = await browser.newPage();
  await login(page, applicantEmail);
  const proposal = await page.evaluate(async () => {
    const response = await fetch('/api/polls/proposals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Mejorar iluminación del pasaje', description: 'Consulta propuesta por un socio para mejorar la seguridad del sector.', options: ['Aprobar proyecto', 'Rechazar proyecto'] }) });
    return { status: response.status, body: await response.json() };
  });
  assert(proposal.status === 201, `Socio no pudo proponer votación: ${JSON.stringify(proposal.body)}`);
  await page.close();
  page = await browser.newPage();
  await login(page, secretary.email);
  const pollApproval = await page.evaluate(async (proposalId) => {
    const response = await fetch(`/api/polls/proposals/${proposalId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision: 'approve' }) });
    return { status: response.status, body: await response.json() };
  }, proposal.body.proposal.id);
  assert(pollApproval.status === 200, `Directiva no pudo aprobar propuesta: ${JSON.stringify(pollApproval.body)}`);
  const { data: publishedPoll } = await admin.from('polls').select('id, active').eq('id', pollApproval.body.pollId).single();
  assert(publishedPoll.active, 'La propuesta aprobada no fue publicada como votación activa');
  console.log('GOVERNANCE_SMOKE_OK access=secretary-approved household=single-due proposal=board-approved');
} finally {
  if (browser) await browser.close();
  for (const userId of [...new Set(users)]) await admin.auth.admin.deleteUser(userId);
  if (juntaId) await admin.from('juntas').delete().eq('id', juntaId);
}
