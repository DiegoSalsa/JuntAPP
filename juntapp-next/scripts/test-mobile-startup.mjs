import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { chromium, devices, webkit } from 'playwright-core';

const production = process.argv.includes('--production');
const iPhone = devices['iPhone 13'];
assert.ok(iPhone, 'Playwright iPhone 13 descriptor is unavailable');

const junta = { id: '11111111-1111-4111-8111-111111111111', name: 'Junta de prueba', slug: 'prueba', subscription_status: 'authorized', subscription_plan: 'juntapp', billing_mode: 'subscription' };
const users = {
  'vecino.demo@juntapp.cl': { id: '22222222-2222-4222-8222-222222222222', email: 'vecino.demo@juntapp.cl', role: 'vecino' },
  'directiva.demo@juntapp.cl': { id: '33333333-3333-4333-8333-333333333333', email: 'directiva.demo@juntapp.cl', role: 'dirigente' },
};
const tokenExpiry = Math.floor(Date.now() / 1000) + 3600;
const tokenFor = (user) => `${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, email: user.email, exp: tokenExpiry, role: 'authenticated' })).toString('base64url')}.mock`;
const userForToken = (token) => Object.values(users).find((user) => token === tokenFor(user));

const mock = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin ?? '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] ?? 'authorization, apikey, content-type, x-client-info, prefer, accept');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }
  const url = new URL(req.url, 'http://localhost');
  const bearer = req.headers.authorization?.replace(/^Bearer /, '');
  const current = userForToken(bearer);
  if (url.pathname === '/auth/v1/token') {
    let body = '';
    for await (const chunk of req) body += chunk;
    const input = JSON.parse(body);
    const user = users[input.email];
    if (!user) { res.writeHead(400).end(JSON.stringify({ message: 'Invalid login credentials' })); return; }
    res.end(JSON.stringify({ access_token: tokenFor(user), token_type: 'bearer', expires_in: 3600, refresh_token: `refresh-${user.id}`, user: { id: user.id, email: user.email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } }));
    return;
  }
  if (url.pathname === '/auth/v1/user') {
    if (!current) { res.writeHead(401).end(JSON.stringify({ message: 'Invalid JWT' })); return; }
    res.end(JSON.stringify({ id: current.id, email: current.email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() }));
    return;
  }
  if (url.pathname.startsWith('/storage/v1/')) { res.end('[]'); return; }
  if (url.pathname.startsWith('/rest/v1/')) {
    if (!current && bearer !== 'mock-service-role') { res.writeHead(401).end(JSON.stringify({ message: 'Invalid JWT' })); return; }
    const table = url.pathname.split('/').pop();
    const account = current ?? users['vecino.demo@juntapp.cl'];
    const profile = { id: account.id, name: account.role === 'dirigente' ? 'Directiva Prueba' : 'Vecino Prueba', rut: '11111111-1', address: 'Calle Prueba 1', role: account.role, board_position: account.role === 'dirigente' ? 'president' : null, junta_id: junta.id, household_id: '44444444-4444-4444-8444-444444444444', juntas: junta };
    const rows = table === 'profiles' ? [profile] : [];
    if (req.method === 'HEAD') { res.setHeader('Content-Range', `0-0/${rows.length}`); res.writeHead(200).end(); return; }
    if (req.headers.accept?.includes('application/vnd.pgrst.object+json')) {
      res.end(JSON.stringify(rows[0] ?? null));
      return;
    }
    res.end(JSON.stringify(rows));
    return;
  }
  res.writeHead(404).end(JSON.stringify({ message: 'Not found' }));
});
mock.listen(0, '127.0.0.1');
await once(mock, 'listening');
const mockPort = mock.address().port;
const appPort = 43000 + Math.floor(Math.random() * 10000);
const appUrl = `http://127.0.0.1:${appPort}`;
const testEnv = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${mockPort}`, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'mock-anon-key', SUPABASE_SERVICE_ROLE_KEY: 'mock-service-role', NEXT_TELEMETRY_DISABLED: '1' };
let app;
let serverOutput = '';

async function buildProduction() {
  const build = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'build'], { env: testEnv, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  build.stdout.on('data', (chunk) => { output += chunk; });
  build.stderr.on('data', (chunk) => { output += chunk; });
  const [code] = await once(build, 'close');
  assert.equal(code, 0, `Production build failed:\n${output.slice(-5000)}`);
  console.log('PASS production build with mock Supabase URL');
}

function startApp() {
  app = spawn(process.execPath, ['node_modules/next/dist/bin/next', production ? 'start' : 'dev', '-p', String(appPort), '-H', '127.0.0.1'], {
    env: testEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  app.stdout.on('data', (chunk) => { serverOutput += chunk; });
  app.stderr.on('data', (chunk) => { serverOutput += chunk; });
}

async function waitForApp() {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${appUrl}/login`)).ok) return; } catch { /* server is starting */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Next did not start: ${serverOutput.slice(-3000)}`);
}

async function runCase(browserType, name, initScript, options = {}) {
  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext(options.ios
    ? { ...iPhone, viewport: { width: 390, height: 844 } }
    : { viewport: { width: options.desktop ? 1366 : 390, height: options.desktop ? 900 : 844 }, isMobile: !options.desktop, hasTouch: !options.desktop });
  await context.route(`http://127.0.0.1:${mockPort}/rest/v1/notifications**`, (route) => {
    if (route.request().method() === 'OPTIONS') return route.continue();
    return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': appUrl, 'access-control-allow-credentials': 'true', 'content-type': 'application/json' }, body: '[]' });
  });
  if (initScript) await context.addInitScript(initScript);
  const page = await context.newPage();
  const pageErrors = [];
  const deviceRegistrations = [];
  page.on('request', (request) => {
    if (request.url().endsWith('/api/notifications/devices') && request.method() === 'POST') {
      deviceRegistrations.push(JSON.parse(request.postData()));
    }
  });
  page.on('pageerror', (error) => { pageErrors.push(error.message); if (process.env.DEBUG_MOBILE_TEST) console.log('PAGE ERROR', error.stack); });
  if (process.env.DEBUG_MOBILE_TEST && name.includes('WebKit')) {
    page.on('request', (request) => { if (request.url().includes('auth/v1')) console.log('AUTH REQUEST', request.url()); });
    page.on('requestfailed', (request) => console.log('REQUEST FAILED', request.url(), request.failure()));
    page.on('console', (message) => console.log('BROWSER CONSOLE', message.type(), message.text()));
  }
  await page.goto(`${appUrl}/login`);
  await page.waitForLoadState('networkidle');
  await page.locator('#email').fill(options.dirigente ? 'directiva.demo@juntapp.cl' : 'vecino.demo@juntapp.cl');
  await page.locator('#password').fill('VecinoDemo2026!');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  try {
    await page.waitForURL('**/inicio', { timeout: 30000 });
  } catch (error) {
    console.error('Login diagnostic', { url: page.url(), errorText: await page.locator('.auth-error-message').allTextContents(), pageErrors, serverOutput: serverOutput.slice(-3000) });
    throw error;
  }
  await page.getByRole('heading', { name: 'Panel de Inicio' }).waitFor({ timeout: 30000 });
  assert.equal(await page.locator('.app-layout').isVisible(), true, `${name}: dashboard hidden`);
  assert.equal(await page.getByRole('heading', { name: 'Instalación y notificaciones' }).isVisible(), true);
  if (options.ios) {
    const device = await page.evaluate(() => ({ userAgent: navigator.userAgent, standalone: navigator.standalone === true, touch: 'ontouchstart' in window }));
    assert.match(device.userAgent, /iphone|ipad|ipod/i, `${name}: iOS user agent missing`);
    assert.equal(device.touch, true, `${name}: touch missing`);
    assert.equal(device.standalone, Boolean(options.iosStandalone), `${name}: standalone mode mismatch`);
    if (options.iosStandalone) {
      await page.getByRole('button', { name: '✓ Instalada' }).waitFor();
      await page.getByText('Las notificaciones no son compatibles', { exact: false }).waitFor();
    } else {
      await page.getByText('En iPhone se activan después de instalar JuntAPP.').waitFor();
      await page.getByRole('button', { name: 'Ver guía visual' }).click();
      await page.getByRole('dialog', { name: 'Lleva JuntAPP a tu iPhone' }).waitFor();
      await page.waitForFunction(() => [...document.querySelectorAll('.install-guide-modal img')].length === 2
        && [...document.querySelectorAll('.install-guide-modal img')].every((image) => image.complete && image.naturalWidth > 0));
      await page.getByRole('button', { name: 'Cerrar guía' }).click();
      assert.equal(await page.locator('.app-layout').isVisible(), true, `${name}: dashboard hidden after iOS guide`);
      assert.equal(await page.getByRole('button', { name: 'Activar notificaciones' }).isDisabled(), true, `${name}: Push activated before installation`);
      assert.equal(await page.evaluate(() => window.__iosPushBootstrapCalls), 0, `${name}: Push setup attempted before installation`);
      assert.equal(await page.evaluate(() => window.__iosServiceWorkerUrls.every((url) => url === '/sw.js')), true, `${name}: unexpected Service Worker URL`);
      assert.equal(await page.evaluate(() => window.__iosPushPermissionCalls), 0, `${name}: Push permission requested before installation`);
      assert.ok(deviceRegistrations.some((registration) => registration.platform === 'ios' && registration.installationStatus === 'browser'), `${name}: app did not detect platform=ios`);
    }
  }
  if (options.serviceWorkerFailure) {
    await page.waitForFunction(() => window.__swRegisterAttempts?.includes('/sw.js'));
    assert.equal(await page.evaluate(() => window.__swRegisterAttempts.every((url) => url === '/sw.js')), true, `${name}: unexpected Service Worker URL`);
  }
  const startPage = await context.newPage();
  startPage.on('pageerror', (error) => { pageErrors.push(error.message); });
  await startPage.goto(`${appUrl}/inicio`);
  assert.equal(new URL(startPage.url()).pathname, '/inicio', `${name}: PWA start URL redirected with a valid session`);
  assert.equal(await startPage.locator('.app-layout').isVisible(), true);
  await startPage.waitForLoadState('networkidle');
  if (options.ssr) {
    const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 }, storageState: await context.storageState() });
    const serverRenderedPage = await noJs.newPage();
    await serverRenderedPage.goto(`${appUrl}/inicio`);
    assert.equal(await serverRenderedPage.locator('.app-layout').isVisible(), true, `${name}: server-rendered dashboard hidden without JavaScript`);
    try {
      await serverRenderedPage.getByRole('heading', { name: /Panel de Inicio|Cargando panel/ }).waitFor({ timeout: 10000 });
    } catch (error) {
      console.error('SSR diagnostic', { url: serverRenderedPage.url(), body: (await serverRenderedPage.locator('body').innerText()).slice(0, 1000), main: await serverRenderedPage.locator('.app-main-content').innerHTML(), bodyClass: await serverRenderedPage.locator('body').getAttribute('class') });
      throw error;
    }
    await noJs.close();
  }
  if (options.unsupported) await page.getByText('Las notificaciones no son compatibles', { exact: false }).waitFor({ timeout: 10000 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  assert.ok(overflow <= 2, `${name}: horizontal overflow ${overflow}px`);
  if (options.desktop) await page.locator('.sidebar-nav').getByRole('link', { name: 'Anuncios Oficiales' }).click();
  else {
    await page.getByRole('button', { name: 'Abrir menú' }).click();
    await page.getByRole('navigation', { name: 'Menú principal' }).getByRole('link', { name: 'Anuncios Oficiales' }).click();
  }
  await page.waitForURL('**/comunicaciones');
  assert.equal(await page.locator('.app-layout').isVisible(), true);
  if (options.desktop) {
    for (const path of ['/socios', '/tesoreria', '/consultas']) {
      await page.goto(`${appUrl}${path}`);
      assert.equal(new URL(page.url()).pathname, path);
      await page.locator('.app-layout').waitFor({ timeout: 10000 });
      assert.equal(await page.getByRole('heading', { name: 'No pudimos cargar esta sección' }).count(), 0, `${name}: ${path} error boundary`);
    }
  }
  assert.deepEqual(pageErrors, [], `${name}: client errors`);
  if (options.serviceWorkerFailure) {
    assert.deepEqual(await page.evaluate(() => window.__swUnhandledRejections), [], `${name}: unhandled Service Worker rejection`);
    console.log('PASS production Service Worker register(/sw.js) attempted and rejection handled');
  }
  console.log(`PASS ${name}: login, /inicio, navigation, overflow=${overflow}`);
  await startPage.close();
  await context.close();
  await browser.close();
}

function simulateIosBrowser() {
  window.__iosServiceWorkerUrls = [];
  window.__iosPushBootstrapCalls = 0;
  window.__iosPushPermissionCalls = 0;
  Object.defineProperty(window, 'Notification', { value: { permission: 'default', requestPermission: () => { window.__iosPushPermissionCalls++; throw new Error('Push must wait for installation'); } }, configurable: true });
  Object.defineProperty(window, 'PushManager', { value: function PushManager() {}, configurable: true });
  Object.defineProperty(navigator, 'serviceWorker', { value: {
    register: (url) => { window.__iosServiceWorkerUrls.push(url); return Promise.reject(new Error('Mock Service Worker failure')); },
    getRegistration: () => { window.__iosPushBootstrapCalls++; throw new Error('Push must wait for installation'); },
  }, configurable: true });
}

function simulateIosStandaloneWithoutPush() {
  Object.defineProperty(navigator, 'standalone', { value: true, configurable: true });
  Object.defineProperty(window, 'Notification', { value: undefined, configurable: true });
  Object.defineProperty(window, 'PushManager', { value: undefined, configurable: true });
}

try {
  if (production) await buildProduction();
  startApp();
  await waitForApp();
  if (production) {
    await runCase(chromium, 'production Service Worker registration fails', () => {
      window.__swRegisterAttempts = [];
      window.__swUnhandledRejections = [];
      window.addEventListener('unhandledrejection', (event) => { window.__swUnhandledRejections.push(String(event.reason)); });
      Object.defineProperty(navigator, 'serviceWorker', { value: {
        register: (url) => { window.__swRegisterAttempts.push(url); return Promise.reject(new Error('Mock registration failure')); },
        getRegistration: () => Promise.reject(new Error('Mock registration failure')),
      }, configurable: true });
    }, { serviceWorkerFailure: true, ssr: true });
    await runCase(webkit, 'production WebKit iPhone browser', simulateIosBrowser, { ios: true, ssr: true });
    await runCase(webkit, 'production WebKit iPhone standalone without Push', simulateIosStandaloneWithoutPush, { ios: true, iosStandalone: true, unsupported: true });
  } else {
  assert.equal((await (await fetch(`${appUrl}/manifest.webmanifest`)).json()).start_url, '/inicio');
  const browser = await chromium.launch();
  const anonymous = await browser.newPage();
  await anonymous.goto(appUrl);
  assert.equal(await anonymous.locator('.corporate-landing').isVisible(), true, 'Public landing hidden');
  await anonymous.getByRole('link', { name: 'Acceder', exact: true }).first().click();
  await anonymous.waitForURL('**/login');
  assert.equal(await anonymous.locator('#email').isVisible(), true, 'Landing Acceder did not open login');
  await anonymous.goto(`${appUrl}/registro`);
  assert.equal((await anonymous.locator('body').innerText()).length > 50, true, 'Registration hidden');
  await anonymous.goto(`${appUrl}/superadmin/login`);
  assert.equal((await anonymous.locator('body').innerText()).length > 20, true, 'Superadmin login hidden');
  await anonymous.goto(`${appUrl}/inicio`);
  await anonymous.waitForURL('**/login');
  console.log('PASS PWA start URL without session redirects to /login');
  await browser.close();
  await runCase(chromium, 'Chromium desktop', null, { desktop: true });
  await runCase(chromium, 'Chromium Android-like', null);
  await runCase(chromium, 'Dirigente mobile', null, { dirigente: true });
  await runCase(chromium, 'crypto.randomUUID unavailable', () => { Object.defineProperty(Crypto.prototype, 'randomUUID', { value: undefined, configurable: true }); });
  await runCase(chromium, 'all crypto random APIs unavailable', () => { Object.defineProperty(Crypto.prototype, 'randomUUID', { value: undefined, configurable: true }); Object.defineProperty(Crypto.prototype, 'getRandomValues', { value: undefined, configurable: true }); });
  await runCase(chromium, 'localStorage blocked', () => { Storage.prototype.getItem = () => { throw new Error('Storage blocked'); }; Storage.prototype.setItem = () => { throw new Error('Storage blocked'); }; });
  await runCase(chromium, 'Push and Notification unavailable', () => { Object.defineProperty(window, 'Notification', { value: undefined, configurable: true }); Object.defineProperty(window, 'PushManager', { value: undefined, configurable: true }); }, { unsupported: true });
  await runCase(chromium, 'Service Worker registration fails in dev', () => { Object.defineProperty(navigator, 'serviceWorker', { value: { register: () => Promise.reject(new Error('Mock registration failure')), getRegistration: () => Promise.reject(new Error('Mock registration failure')) }, configurable: true }); });
  await runCase(webkit, 'WebKit iPhone browser', simulateIosBrowser, { ios: true, ssr: true });
  await runCase(webkit, 'WebKit iPhone standalone without Push', simulateIosStandaloneWithoutPush, { ios: true, iosStandalone: true, unsupported: true });
  }
} finally {
  app?.kill();
  mock.close();
}
