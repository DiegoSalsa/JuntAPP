import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHmac } from 'node:crypto';
import { startFixture } from './fixtures/dues-ui.mjs';
import { sessionSecret } from './fixtures/ux-ui-v2-data.mjs';

const phase = process.argv.includes('--before') ? 'before' : 'after';
const sizes = [{ width: 320, height: 640 }, { width: 360, height: 800 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1280, height: 800 }, { width: 1440, height: 900 }];
const dir = process.argv.includes('--corrected')
  ? '../qa-evidence/ux-ui-v2/corrected-after'
  : `../qa-evidence/ux-ui-v2/${phase}`;
await mkdir(dir, { recursive: true });
const fixture = await startFixture({ visual: true, serve: process.argv.includes('--serve') });
if (process.argv.includes('--serve')) {
  console.log(`V2 visual fixture: ${fixture.appUrl} — directiva@example.test / nuevo@example.test, any password; fictional local data only.`);
  process.on('SIGINT', async () => { await fixture.stop(); process.exit(0); });
} else {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    for (const role of ['directiva', 'vecino']) {
      for (const viewport of sizes) {
        const context = await browser.newContext({ viewport });
        const page = await context.newPage();
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.goto(`${fixture.appUrl}/login`);
        await page.locator('#email').fill(role === 'directiva' ? 'directiva@example.test' : 'nuevo@example.test');
        await page.locator('#password').fill('local-test-password');
        await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
        await page.waitForURL('**/inicio');
        const routes = role === 'directiva' ? ['inicio','socios','tesoreria','consultas','comunicaciones','mi-pagina'] : ['inicio','tesoreria','consultas','socios'];
        for (const route of routes) {
          await page.goto(`${fixture.appUrl}/${route}`); await page.waitForLoadState('networkidle');
          await page.screenshot({ path: `${dir}/${role}-${route}-${viewport.width}x${viewport.height}.png`, fullPage: true });
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
          results.push({ role, route, viewport, overflow, errors: errors.slice() });
          console.log(`${phase} ${role} ${route} ${viewport.width}: overflow=${overflow}`);
        }
        if (role === 'directiva' && viewport.width === 390) {
          await page.goto(`${fixture.appUrl}/inicio`);
          await page.getByRole('button', { name: 'Abrir menú', exact: true }).click();
          await page.screenshot({ path: `${dir}/mobile-menu-390x844.png` });
          await page.goto(`${fixture.appUrl}/socios`);
          await page.getByRole('button', { name: 'Gestionar Cuota del Domicilio', exact: true }).first().click();
          await page.screenshot({ path: `${dir}/manual-payment-dialog-390x844.png` });
          await page.goto(`${fixture.appUrl}/comunicaciones`);
          await page.getByRole('button', { name: /Publicar Anuncio Oficial|Nuevo comunicado/ }).click();
          await page.screenshot({ path: `${dir}/announcement-dialog-390x844.png` });
        }
        await context.close();
      }
    }
    // Local signed session uses the real verifier against an ephemeral test secret.
    // The allowlisted address is hidden in screenshots; no real account is contacted.
    const encoded = Buffer.from(JSON.stringify({ kind: 'session', version: 1, id: 'superadmin:qa-local', email: 'diego.guzman@purocode.com', name: 'Operador QA ficticio', expiresAt: Math.floor(Date.now()/1000)+3600 })).toString('base64url');
    const token = `${encoded}.${createHmac('sha256', sessionSecret).update(`session:${encoded}`).digest('base64url')}`;
    for (const viewport of sizes) {
      const context = await browser.newContext({ viewport });
      await context.addCookies([{ name: 'juntapp_superadmin_session', value: token, url: fixture.appUrl }]);
      const page = await context.newPage();
      for (const route of ['superadmin','superadmin/juntas','superadmin/usuarios','superadmin/operaciones']) {
        await page.goto(`${fixture.appUrl}/${route}`); await page.waitForLoadState('networkidle');
        await page.evaluate(() => { for (const node of document.querySelectorAll('p')) if (node.textContent === 'diego.guzman@purocode.com') node.textContent = 'operador-qa@example.invalid'; });
        await page.screenshot({ path: `${dir}/${route.replaceAll('/','-')}-${viewport.width}x${viewport.height}.png`, fullPage: true });
        results.push({ role: 'superadmin-local', route, viewport, overflow: await page.evaluate(() => document.documentElement.scrollWidth-innerWidth) });
      }
      await context.close();
    }
    await writeFile(`${dir}/results.json`, JSON.stringify(results, null, 2));
    console.log(`QA_${phase.toUpperCase()}_COMPLETE captures=${results.length} results=${dir}/results.json`);
  } finally { await browser.close(); await fixture.stop(); }
}
