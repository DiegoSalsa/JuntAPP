import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright-core';
import { createClient } from '@supabase/supabase-js';

const baseUrl = process.env.JUNTAPP_TEST_URL ?? 'http://localhost:3000';
const testKeys = [];
const users = [
  { email: 'directiva.demo@juntapp.cl', password: 'DirectivaDemo2026!', dirigente: true },
  { email: 'vecino.demo@juntapp.cl', password: 'VecinoDemo2026!', dirigente: false },
];
const viewports = [
  { name: 'desktop', width: 1366, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];
const browser = await chromium.launch({ headless: true });
let iosBrowser;

async function login(page, user) {
  await page.goto(`${baseUrl}/login`);
  await page.locator('#email').fill(user.email);
  await page.locator('#password').fill(user.password);
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await page.waitForURL('**/inicio');
  await page.getByRole('heading', { name: 'Instalación y notificaciones' }).waitFor();
}

try {
  for (const viewport of viewports) {
    for (const user of users) {
      const key = `${user.dirigente ? 'board' : 'neighbor'}-${viewport.name}-notifications-test`;
      testKeys.push(key);
      const context = await browser.newContext({ viewport });
      await context.addInitScript((storedKey) => localStorage.setItem('juntapp-device-key', storedKey), key);
      const page = await context.newPage();
      const errors = [];
      page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
      page.on('pageerror', (error) => errors.push(error.message));
      await login(page, user);
      const center = page.getByRole('region', { name: 'Instalación y notificaciones' });
      await center.getByRole('heading', { name: 'Instala JuntAPP' }).waitFor();
      await center.getByRole('heading', { name: 'Activa las notificaciones' }).waitFor();
      if (user.dirigente) await center.getByText('Cobertura de avisos', { exact: true }).waitFor({ timeout: 15_000 });
      else assert.equal(await center.getByText('Cobertura de avisos', { exact: true }).count(), 0);
      const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
      assert.ok(overflow <= 2, `${viewport.name}/${user.email}: desborde horizontal ${overflow}px.`);
      assert.deepEqual(errors, [], `${viewport.name}/${user.email}: errores de consola.`);
      console.log(JSON.stringify({ ui: 'OK', viewport: viewport.name, role: user.dirigente ? 'dirigente' : 'vecino', overflow }));
      await context.close();
    }
  }

  const iosKey = 'iphone-notifications-visual-test';
  testKeys.push(iosKey);
  iosBrowser = await webkit.launch({ headless: true });
  const ios = await iosBrowser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1' });
  await ios.addInitScript((storedKey) => localStorage.setItem('juntapp-device-key', storedKey), iosKey);
  const page = await ios.newPage();
  await login(page, users[1]);
  await page.getByRole('button', { name: 'Ver guía visual' }).click();
  const dialog = page.getByRole('dialog', { name: 'Lleva JuntAPP a tu iPhone' });
  await dialog.waitFor();
  assert.equal(await dialog.locator('.ios-visual-card').count(), 3);
  assert.equal(await dialog.locator('.iphone-frame').count(), 1);
  const iosOverflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
  assert.ok(iosOverflow <= 2, `iPhone: desborde horizontal ${iosOverflow}px.`);
  console.log(JSON.stringify({ ui: 'OK', viewport: 'iphone', visualCards: 3, overflow: iosOverflow }));
  await ios.close();

  const androidKey = 'android-install-instructions-test';
  testKeys.push(androidKey);
  const android = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36' });
  await android.addInitScript((storedKey) => localStorage.setItem('juntapp-device-key', storedKey), androidKey);
  const androidPage = await android.newPage();
  await login(androidPage, users[1]);
  await androidPage.getByRole('button', { name: 'Cómo instalar' }).click();
  await androidPage.getByText('En Android, abre el menú ⋮ de Chrome', { exact: false }).waitFor();
  assert.equal(await androidPage.getByRole('dialog', { name: 'Lleva JuntAPP a tu iPhone' }).count(), 0);
  const androidOverflow = await androidPage.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
  assert.ok(androidOverflow <= 2, `Android: desborde horizontal ${androidOverflow}px.`);
  console.log(JSON.stringify({ ui: 'OK', viewport: 'android', iphoneGuideHidden: true, overflow: androidOverflow }));
  await android.close();
} finally {
  if (iosBrowser) await iosBrowser.close();
  await browser.close();
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && testKeys.length) {
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    await admin.from('app_devices').delete().in('device_key', testKeys);
    await new Promise((resolve) => setTimeout(resolve, 750));
    await admin.from('app_devices').delete().in('device_key', testKeys);
  }
}
