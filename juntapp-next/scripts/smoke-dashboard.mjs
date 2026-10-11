import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

function readEnv(file) {
  return Object.fromEntries(fs.readFileSync(file, 'utf8').split(/\r?\n/).filter((line) => line && !line.startsWith('#') && line.includes('=')).map((line) => {
    const index = line.indexOf('=');
    return [line.slice(0, index), line.slice(index + 1)];
  }));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const env = readEnv(path.resolve('.env.local'));
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = env.SUPABASE_SERVICE_ROLE_KEY;
const stamp = Date.now();
const email = `codex-ui-smoke-${stamp}@example.com`;
const password = 'TemporaryTest987!';
let userId;
let juntaId;
let browser;

const adminHeaders = { apikey: secretKey, Authorization: `Bearer ${secretKey}`, 'User-Agent': 'JuntAPP-Server/1.0' };

async function expectRoute(page, route, title) {
  const desktopNavigation = page.locator(`#nav-${route}`);
  if (await desktopNavigation.isVisible()) {
    await desktopNavigation.click();
  } else {
    await page.goto(`${new URL(page.url()).origin}/${route}`);
  }
  await page.waitForURL(`**/${route}`);
  await page.locator('.view-title').waitFor({ state: 'visible' });
  assert((await page.locator('.view-title').textContent())?.includes(title), `Título incorrecto en /${route}`);
}

try {
  const signup = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST', headers: { ...adminHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { name: 'Cuenta Prueba Navegación', rut: `95${stamp}`, address: 'Dirección temporal', phone: '+56 9 1234 5678', junta_action: 'create', junta_name: `Junta UI Temporal ${stamp}`, junta_region: 'Valparaíso', junta_comuna: 'Valparaíso' } }),
  });
  const signupData = await signup.json();
  assert(signup.ok, `No se pudo crear usuario temporal: ${JSON.stringify(signupData)}`);
  userId = signupData.id ?? signupData.user?.id;
  const profileResponse = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=junta_id`, { headers: adminHeaders });
  const profiles = await profileResponse.json();
  juntaId = profiles[0]?.junta_id;
  assert(juntaId, 'El trigger no creó el perfil temporal');
  const activationResponse = await fetch(`${supabaseUrl}/rest/v1/juntas?id=eq.${juntaId}`, { method: 'PATCH', headers: { ...adminHeaders, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ subscription_status: 'authorized', activated_at: new Date().toISOString() }) });
  assert(activationResponse.ok, 'No se pudo activar la junta temporal para el smoke del dashboard');

  browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const pageErrors = [];
  const failedRequests = [];
  const consoleErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('requestfailed', (request) => {
    const failure = request.failure()?.errorText;
    if (request.url().startsWith('http://localhost:3000') && failure !== 'net::ERR_ABORTED') {
      failedRequests.push(`${request.method()} ${request.url()} ${failure}`);
    }
  });

  await page.goto('http://localhost:3000/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await page.waitForURL('**/inicio');
  await page.locator('.stats-grid').waitFor({ state: 'visible' });
  try {
    await page.waitForFunction(() => document.querySelector('#userProfileName')?.textContent !== 'Cargando...', null, { timeout: 5000 });
  } catch {
    console.log('HYDRATION_DEBUG', JSON.stringify(await page.evaluate(() => ({ profile: document.querySelector('#userProfileName')?.textContent, bodyClass: document.body.className, scripts: [...document.scripts].map((script) => script.src).filter(Boolean), nextError: document.querySelector('nextjs-portal')?.textContent?.slice(0, 1000) }))));
    console.log('PAGE_ERRORS', JSON.stringify(pageErrors));
    console.log('CONSOLE_ERRORS', JSON.stringify(consoleErrors));
    console.log('FAILED_REQUESTS', JSON.stringify(failedRequests));
    throw new Error('El dashboard no hidrató');
  }
  assert((await page.locator('#userProfileName').textContent())?.includes('Cuenta Prueba'), 'El perfil no se hidrató');

  await page.locator('.tour-help-btn').click();
  await page.locator('.driver-popover').waitFor({ state: 'visible' });
  await page.locator('.driver-popover-close-btn').click();

  await expectRoute(page, 'socios', 'Registro de Socios');
  await page.getByRole('button', { name: /Inscribir Nuevo Socio/ }).click();
  await page.locator('.modal.active').waitFor({ state: 'visible' });
  await page.locator('.modal.active .modal-close').click();

  await expectRoute(page, 'tesoreria', 'Tesorería Transparente');
  await page.getByRole('button', { name: /Registrar Movimiento/ }).click();
  await page.locator('.modal.active').waitFor({ state: 'visible' });
  await page.locator('.modal.active input[name="description"]').fill('Movimiento smoke test');
  await page.locator('.modal.active input[name="amount"]').fill('12500');
  await page.locator('.modal.active form').evaluate((form) => form.requestSubmit());
  await page.locator('.modal.active').waitFor({ state: 'hidden' });
  await page.getByText('Movimiento smoke test').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: /Generar Reporte Mensual/ }).click();
  await page.locator('.report-modal.active').waitFor({ state: 'visible' });
  await page.locator('.report-modal.active .modal-close').click();

  await expectRoute(page, 'consultas', 'Consultas Comunitarias');
  await page.getByRole('button', { name: /Crear Nueva Consulta/ }).click();
  await page.locator('.modal.active').waitFor({ state: 'visible' });
  await page.locator('.modal.active input[name="title"]').fill('Consulta smoke test');
  await page.locator('.modal.active textarea[name="description"]').fill('Descripción de la consulta temporal para verificar Supabase.');
  await page.locator('.modal.active .poll-option-editor input').nth(0).fill('Alternativa Uno');
  await page.locator('.modal.active .poll-option-editor input').nth(1).fill('Alternativa Dos');
  await page.locator('.modal.active form').evaluate((form) => form.requestSubmit());
  await page.locator('.modal.active').waitFor({ state: 'hidden' });
  await page.getByText('Consulta smoke test').waitFor({ state: 'visible' });
  await page.locator('.poll-option-card').first().click();
  await page.getByRole('button', { name: /Confirmar mi respuesta/ }).click();
  await page.getByText(/Respuesta registrada con éxito/).waitFor({ state: 'visible' });

  await expectRoute(page, 'comunicaciones', 'Anuncios Oficiales');
  await page.getByRole('button', { name: /Publicar Anuncio Oficial/ }).click();
  await page.locator('.modal.active').waitFor({ state: 'visible' });
  await page.locator('.modal.active input[name="title"]').fill('Anuncio smoke test');
  await page.locator('.modal.active textarea[name="content"]').fill('Contenido temporal para verificar publicación y notificaciones.');
  await page.locator('.modal.active form').evaluate((form) => form.requestSubmit());
  await page.locator('.modal.active').waitFor({ state: 'hidden' });
  await page.getByText('Anuncio smoke test').waitFor({ state: 'visible' });

  await page.locator('#bellToggle').click();
  await page.locator('.notifications-panel.active').waitFor({ state: 'visible' });
  await page.getByText('Anuncio smoke test').last().waitFor({ state: 'visible' });
  await page.locator('#bellToggle').click();
  await page.locator('.notifications-panel').waitFor({ state: 'hidden' });

  fs.mkdirSync(path.resolve('.test-artifacts'), { recursive: true });
  await page.screenshot({ path: path.resolve('.test-artifacts/dashboard-desktop.png'), fullPage: true });
  const dashboardBounds = await page.locator('.app-layout').boundingBox();
  const viewport = page.viewportSize();
  assert(dashboardBounds && viewport && dashboardBounds.y + dashboardBounds.height >= viewport.height - 1, 'El fondo del dashboard no cubre toda la ventana');
  assert(await page.locator('.original-dashboard-root').evaluate((element) => getComputedStyle(element).zoom) === '1', 'El dashboard tiene zoom interno y deja un espacio blanco');
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileRoutes = [
    ['inicio', 'Panel de Inicio'],
    ['socios', 'Registro de Socios'],
    ['tesoreria', 'Tesorería Transparente'],
    ['consultas', 'Consultas Comunitarias'],
    ['comunicaciones', 'Anuncios Oficiales'],
  ];
  for (const [route, title] of mobileRoutes) {
    await page.goto(`http://localhost:3000/${route}`);
    await page.locator('.view-title').waitFor({ state: 'visible' });
    assert((await page.locator('.view-title').textContent())?.includes(title), `Título móvil incorrecto en /${route}`);
    assert(await page.locator('.mobile-header').isVisible(), `El header móvil no aparece en /${route}`);
    const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, page: document.documentElement.scrollWidth }));
    assert(dimensions.page <= dimensions.viewport, `Desborde horizontal en /${route}: ${dimensions.page}px > ${dimensions.viewport}px`);
  }
  await page.locator('.mobile-menu-toggle').click();
  assert(await page.locator('.mobile-navigation-menu').isVisible(), 'La navegación móvil no aparece');

  await page.screenshot({ path: path.resolve('.test-artifacts/dashboard-mobile.png'), fullPage: true });
  assert(pageErrors.length === 0, `Errores del navegador: ${pageErrors.join(' | ')}`);
  assert(!consoleErrors.some((message) => /hydration|server rendered|didn't match/i.test(message)), `Errores de hidratación: ${consoleErrors.join(' | ')}`);
  assert(failedRequests.length === 0, `Peticiones fallidas: ${failedRequests.join(' | ')}`);
  console.log('SMOKE_OK routes=5 navigation=ok hydration=ok transaction=create consultation=create+answer announcement=create notifications=realtime modals=ok tour=ok mobile-overflow=ok');
} finally {
  if (browser) await browser.close();
  if (userId) await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, { method: 'DELETE', headers: adminHeaders });
  if (juntaId) await fetch(`${supabaseUrl}/rest/v1/juntas?id=eq.${juntaId}`, { method: 'DELETE', headers: { ...adminHeaders, Prefer: 'return=minimal' } });
}
