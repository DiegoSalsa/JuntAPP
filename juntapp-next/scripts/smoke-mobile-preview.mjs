import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright-core';

const baseUrl = process.env.JUNTAPP_TEST_URL;
const email = process.env.JUNTAPP_TEST_EMAIL;
const password = process.env.JUNTAPP_TEST_PASSWORD;
if (!baseUrl || !email || !password) {
  throw new Error('Define JUNTAPP_TEST_URL, JUNTAPP_TEST_EMAIL y JUNTAPP_TEST_PASSWORD.');
}
const previewHost = new URL(baseUrl).hostname;
function requirePreviewAccess(page) {
  if (new URL(page.url()).hostname !== previewHost) {
    throw new Error('El preview redirige al SSO de Vercel. Se necesita acceso al proyecto o un bypass de Deployment Protection.');
  }
}

async function smoke(browserType, label, viewport, mobile) {
  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
  // Preview checks access and navigation without registering test push devices.
  await context.addInitScript(() => {
    Object.defineProperty(window, 'Notification', { value: undefined, configurable: true });
    Object.defineProperty(window, 'PushManager', { value: undefined, configurable: true });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.goto(`${baseUrl}/login`);
    requirePreviewAccess(page);
    await page.waitForLoadState('networkidle');
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
    await page.waitForURL('**/inicio', { timeout: 30000 });
    await page.getByRole('heading', { name: 'Panel de Inicio' }).waitFor({ timeout: 30000 });
    assert.equal(await page.locator('.app-layout').isVisible(), true);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert.ok(overflow <= 2, `${label}: horizontal overflow ${overflow}px`);
    if (mobile) {
      await page.getByRole('button', { name: 'Abrir menú' }).click();
      await page.getByRole('navigation', { name: 'Menú principal' }).getByRole('link', { name: 'Anuncios Oficiales' }).click();
    } else {
      await page.locator('.sidebar-nav').getByRole('link', { name: 'Anuncios Oficiales' }).click();
    }
    await page.waitForURL('**/comunicaciones');
    assert.equal(await page.locator('.app-layout').isVisible(), true);
    assert.deepEqual(errors, [], `${label}: client errors`);
    console.log(`PASS ${label}: preview login, /inicio, navigation, overflow=${overflow}`);
  } finally {
    await context.close();
    await browser.close();
  }
}

const anonymous = await chromium.launch({ headless: true });
try {
  const page = await anonymous.newPage();
  await page.goto(`${baseUrl}/inicio`);
  requirePreviewAccess(page);
  await page.waitForURL('**/login');
  console.log('PASS preview /inicio without session redirects to /login');
} finally {
  await anonymous.close();
}

await smoke(chromium, 'Chromium desktop', { width: 1366, height: 900 }, false);
await smoke(chromium, 'Chromium Android-like', { width: 390, height: 844 }, true);
await smoke(webkit, 'WebKit iPhone', { width: 390, height: 844 }, true);
