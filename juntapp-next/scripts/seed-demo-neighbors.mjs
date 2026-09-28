import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

function readEnv(file) {
  return Object.fromEntries(fs.readFileSync(file, 'utf8').split(/\r?\n/).filter((line) => line && !line.startsWith('#') && line.includes('=')).map((line) => {
    const index = line.indexOf('=');
    return [line.slice(0, index), line.slice(index + 1)];
  }));
}

function rutFrom(body) {
  let multiplier = 2;
  let sum = 0;
  for (let index = body.length - 1; index >= 0; index -= 1) {
    sum += Number(body[index]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const result = 11 - (sum % 11);
  return `${body}${result === 11 ? '0' : result === 10 ? 'K' : result}`;
}

const DEMO_PASSWORD = 'VecinoDemo2026!';
const BOARD_DEMO_EMAIL = 'directiva.demo@juntapp.cl';
const BOARD_DEMO_PASSWORD = 'DirectivaDemo2026!';
const neighbors = [
  { email: 'vecino.demo@juntapp.cl', name: 'Camila Rojas Fuentes', rut: rutFrom('17123456'), address: 'Avenida Los Pinos 123, Depto 4', phone: '+56 9 2100 1001' },
  { email: 'tomas.demo@juntapp.cl', name: 'Tomás Rojas Fuentes', rut: rutFrom('18234567'), address: 'Av. Los Pinos #123 Dpto. 4', phone: '+56 9 2100 1002' },
  { email: 'ana.demo@juntapp.cl', name: 'Ana Morales Díaz', rut: rutFrom('19345678'), address: 'Pasaje Los Aromos 345', phone: '+56 9 2100 1003' },
  { email: 'juan.demo@juntapp.cl', name: 'Juan Morales Díaz', rut: rutFrom('20456789'), address: 'Pje. Los Aromos Nro. 345', phone: '+56 9 2100 1004' },
  { email: 'carolina.demo@juntapp.cl', name: 'Carolina Pérez Soto', rut: rutFrom('15567890'), address: 'Calle Las Acacias 880', phone: '+56 9 2100 1005' },
  { email: 'diego.demo@juntapp.cl', name: 'Diego Pérez Soto', rut: rutFrom('16678901'), address: 'Calle Las Acacias #880', phone: '+56 9 2100 1006' },
  { email: 'elena.demo@juntapp.cl', name: 'Elena Contreras Silva', rut: rutFrom('13789012'), address: 'Camino El Sol 72', phone: '+56 9 2100 1007' },
  { email: 'roberto.demo@juntapp.cl', name: 'Roberto Contreras Silva', rut: rutFrom('14890123'), address: 'Cno. El Sol N° 72', phone: '+56 9 2100 1008' },
];

const env = readEnv(path.resolve('.env.local'));
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: demoAdmin, error: adminError } = await admin.from('profiles')
  .select('junta_id, juntas(invite_code, subscription_status)')
  .eq('email', 'admin@juntapp.cl')
  .single();
if (adminError || !demoAdmin) throw adminError ?? new Error('No existe la cuenta administradora demo.');
const junta = Array.isArray(demoAdmin.juntas) ? demoAdmin.juntas[0] : demoAdmin.juntas;
if (!junta?.invite_code || junta.subscription_status !== 'authorized') throw new Error('La junta demo no está activa o no tiene código.');

async function authorize(email, rut) { const { error } = await admin.from('member_invitations').insert({ junta_id: demoAdmin.junta_id, email: email.toLowerCase(), rut }); if (error) throw error; }

const boardMetadata = {
  name: 'Administración Demo',
  rut: rutFrom('12654321'),
  address: 'Sede Vecinal 10',
  phone: '+56 9 2100 1099',
  junta_action: 'join',
  invite_code: junta.invite_code,
};

const { data: existingBoardProfile } = await admin.from('profiles').select('id').eq('email', BOARD_DEMO_EMAIL).maybeSingle();
if (existingBoardProfile) {
  const { error: boardAuthError } = await admin.auth.admin.updateUserById(existingBoardProfile.id, {
    password: BOARD_DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: boardMetadata,
  });
  if (boardAuthError) throw boardAuthError;
} else {
  await authorize(BOARD_DEMO_EMAIL, boardMetadata.rut);
  const { error: boardCreateError } = await admin.auth.admin.createUser({
    email: BOARD_DEMO_EMAIL,
    password: BOARD_DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: boardMetadata,
  });
  if (boardCreateError) throw boardCreateError;
}
const { error: boardProfileError } = await admin.from('profiles').update({
  name: boardMetadata.name,
  rut: boardMetadata.rut,
  address: boardMetadata.address,
  phone: boardMetadata.phone,
  role: 'dirigente',
  board_position: 'dirigente',
  cuota_status: 'al_dia',
}).eq('email', BOARD_DEMO_EMAIL).eq('junta_id', demoAdmin.junta_id);
if (boardProfileError) throw boardProfileError;

for (const neighbor of neighbors) {
  const { data: existingProfile } = await admin.from('profiles').select('id').eq('email', neighbor.email).maybeSingle();
  if (existingProfile) {
    const { error: authError } = await admin.auth.admin.updateUserById(existingProfile.id, {
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { name: neighbor.name, rut: neighbor.rut, address: neighbor.address, phone: neighbor.phone, junta_action: 'join', invite_code: junta.invite_code },
    });
    if (authError) throw authError;
    const { error: profileError } = await admin.from('profiles').update({ name: neighbor.name, rut: neighbor.rut, address: neighbor.address, phone: neighbor.phone, role: 'vecino', board_position: null }).eq('id', existingProfile.id).eq('junta_id', demoAdmin.junta_id);
    if (profileError) throw profileError;
    continue;
  }

  await authorize(neighbor.email, neighbor.rut);
  const { error: createError } = await admin.auth.admin.createUser({
    email: neighbor.email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { name: neighbor.name, rut: neighbor.rut, address: neighbor.address, phone: neighbor.phone, junta_action: 'join', invite_code: junta.invite_code },
  });
  if (createError) throw createError;
}

const { data: seededProfiles, error: profilesError } = await admin.from('profiles')
  .select('id, email, address, household_id, cuota_status')
  .eq('junta_id', demoAdmin.junta_id)
  .in('email', neighbors.map((neighbor) => neighbor.email));
if (profilesError) throw profilesError;

const losPinosMembers = seededProfiles.filter((profile) => ['vecino.demo@juntapp.cl', 'tomas.demo@juntapp.cl'].includes(profile.email));
if (losPinosMembers.length !== 2 || losPinosMembers[0].household_id !== losPinosMembers[1].household_id) {
  throw new Error('La normalización no agrupó las variantes del domicilio Los Pinos.');
}

// Prove the database does not trust a client-supplied household id. Even when
// a caller sends the Camino El Sol id, this Las Acacias address must win.
const carolina = seededProfiles.find((profile) => profile.email === 'carolina.demo@juntapp.cl');
const diego = seededProfiles.find((profile) => profile.email === 'diego.demo@juntapp.cl');
const elena = seededProfiles.find((profile) => profile.email === 'elena.demo@juntapp.cl');
if (!carolina || !diego || !elena) throw new Error('Faltan vecinos para probar la defensa de domicilio.');

try {
  const { data: defendedProfile, error: defenseError } = await admin.from('profiles')
    .update({ address: 'Calle Las Acacias N° 880', household_id: elena.household_id })
    .eq('id', diego.id)
    .select('household_id')
    .single();
  if (defenseError) throw defenseError;
  if (defendedProfile.household_id !== carolina.household_id) {
    throw new Error('El servidor aceptó un household_id incompatible con la dirección.');
  }
} finally {
  const { error: restoreError } = await admin.from('profiles')
    .update({ address: 'Calle Las Acacias #880', household_id: carolina.household_id })
    .eq('id', diego.id);
  if (restoreError) throw restoreError;
}

const paidHouseholdId = losPinosMembers[0].household_id;
const { error: paymentError } = await admin.rpc('set_manual_household_due', {
  p_household_id: paidHouseholdId,
  p_junta_id: demoAdmin.junta_id,
  p_action: 'paid',
  p_method: 'transfer',
});
if (paymentError) throw paymentError;

const period = `${new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit' }).format(new Date()).slice(0, 7)}-01`;
const [{ data: dues, error: duesError }, { data: paidMembers, error: paidMembersError }, { data: households, error: householdsError }] = await Promise.all([
  admin.from('member_dues').select('id, household_id, status, amount').eq('household_id', paidHouseholdId).eq('period', period),
  admin.from('profiles').select('email, cuota_status').eq('household_id', paidHouseholdId),
  admin.from('households').select('id, normalized_address').eq('junta_id', demoAdmin.junta_id).in('id', seededProfiles.map((profile) => profile.household_id)),
]);
if (duesError || paidMembersError || householdsError) throw duesError ?? paidMembersError ?? householdsError;
if (dues.length !== 1 || dues[0].status !== 'paid') throw new Error('El domicilio demo no tiene exactamente una cuota pagada en el período.');
if (!paidMembers.every((member) => member.cuota_status === 'al_dia')) throw new Error('El pago no dejó al día a todos los vecinos del domicilio.');
if (new Set(households.map((household) => household.id)).size !== 4) throw new Error('Las ocho variantes demo no se consolidaron en cuatro domicilios.');

const demoClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: login, error: loginError } = await demoClient.auth.signInWithPassword({
  email: 'vecino.demo@juntapp.cl',
  password: DEMO_PASSWORD,
});
if (loginError || !login.user) throw loginError ?? new Error('La cuenta vecino demo no pudo iniciar sesión.');
const { data: visibleProfile, error: visibleProfileError } = await demoClient.from('profiles')
  .select('role, household_id, cuota_status')
  .eq('id', login.user.id)
  .single();
if (visibleProfileError || !visibleProfile) throw visibleProfileError ?? new Error('El vecino demo no puede leer su perfil.');
if (visibleProfile.role !== 'vecino' || visibleProfile.household_id !== paidHouseholdId || visibleProfile.cuota_status !== 'al_dia') {
  throw new Error('La sesión del vecino demo no refleja el domicilio pagado esperado.');
}
await demoClient.auth.signOut();

console.log(JSON.stringify({
  result: 'DEMO_NEIGHBORS_OK',
  neighbors: seededProfiles.length,
  uniqueHouseholds: new Set(seededProfiles.map((profile) => profile.household_id)).size,
  paidHouseholdMembers: paidMembers.length,
  currentDueRows: dues.length,
  boardLogin: { email: BOARD_DEMO_EMAIL, password: BOARD_DEMO_PASSWORD },
  demoLogin: { email: 'vecino.demo@juntapp.cl', password: DEMO_PASSWORD },
}, null, 2));
