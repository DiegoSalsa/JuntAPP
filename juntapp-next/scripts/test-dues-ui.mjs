import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
import { startFixture } from './fixtures/dues-ui.mjs';

const serve = process.argv.includes('--serve');
const fixture = await startFixture({ serve });
if (serve) {
  console.log(`UI fixture: ${fixture.appUrl} (directiva@example.test or nuevo@example.test; any password). Local mock data only.`);
  process.on('SIGINT', async () => { await fixture.stop(); process.exit(0); });
} else {
  const browser = await chromium.launch({ headless: true });
  const artifactDir = '.test-artifacts/dues-ui';
  await mkdir(artifactDir, { recursive: true });
  try {
    for (const viewport of [{ width: 1366, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 640 }]) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      const errors = []; page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(`${fixture.appUrl}/login`);
      await page.locator('#email').fill('directiva@example.test'); await page.locator('#password').fill('test-password');
      await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
      try { await page.waitForURL('**/inicio'); } catch (error) { console.error({ error: error.message, url: page.url(), authError: await page.locator('.auth-error-message').allTextContents() }); throw error; }
      await page.goto(`${fixture.appUrl}/tesoreria`); try { await page.locator('.due-period-grid').waitFor(); } catch (error) { console.error({ url: page.url(), body: (await page.locator('body').innerText()).slice(0, 1800), error: error.message }); throw error; }
      assert.equal(await page.getByText('1 seleccionados', { exact: true }).count(), 0);
      if (await page.getByText('⌛ En proceso', { exact: true }).count()) console.error('in-progress cards', await page.locator('.due-period-card').allTextContents());
      assert.equal(await page.getByText('⌛ En proceso', { exact: true }).count(), 0);
      assert.equal(await page.getByText('↻ Intento vencido · renovar', { exact: true }).count(), 1);
      const year = page.locator('#due-calendar-year');
      await page.getByText('Noviembre de 2026', { exact: true }).locator('..').locator('input').check();
      await page.getByText('Diciembre de 2026', { exact: true }).locator('..').locator('input').check();
      await year.selectOption('2027');
      for (const month of ['Enero de 2027', 'Febrero de 2027', 'Marzo de 2027']) {
        await page.getByText(month, { exact: true }).locator('..').locator('input').check();
      }
      assert.match(await page.locator('.selected-period-summary').innerText(), /6\/12/);
      await page.screenshot({ path: `${artifactDir}/treasury-${viewport.width}.png`, fullPage: true });
      if (process.argv.includes('--audit')) {
        console.log(JSON.stringify({ viewport, overflow: await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), treasuryText: (await page.locator('#view-tesoreria').innerText()).slice(0, 2800) }));
        await page.goto(`${fixture.appUrl}/socios`); await page.getByRole('button', { name: 'Gestionar Cuota del Domicilio' }).first().click();
        await page.screenshot({ path: `${artifactDir}/manual-${viewport.width}.png`, fullPage: true });
        console.log(JSON.stringify({ modalText: await page.getByRole('dialog').innerText() }));
        const dialog = page.getByRole('dialog');
        const dialogBox = await dialog.locator('.modal-dialog').boundingBox();
        assert.ok(dialogBox, 'manual payment dialog should be visible');
        assert.ok(dialogBox.height <= viewport.height - 16, `manual dialog exceeds viewport: ${dialogBox.height}px`);
        assert.equal(await dialog.locator('.modal-body').evaluate((element) => getComputedStyle(element).overflowY), 'auto');
        await page.screenshot({ path: `${artifactDir}/manual-${viewport.width}-viewport.png` });
        await page.getByRole('button', { name: 'Revertir pago manual', exact: true }).click();
        assert.equal(await page.locator('.due-period-batch-option').count(), 1);
        assert.match(await page.locator('.due-period-batch-option').innerText(), /2 cuotas manuales/);
        await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
        const manageButtons = page.getByRole('button', { name: 'Gestionar Cuota del Domicilio', exact: true });
        assert.equal(await manageButtons.count(), 2);
        await manageButtons.nth(1).click();
        assert.equal(await page.locator('.due-period-option').count(), 12);
        for (const option of await page.locator('.due-period-option input').all()) {
          if (await page.locator('.due-period-option input:checked').count() < 6) await option.check();
        }
        assert.equal(await page.getByRole('button', { name: 'Registrar 6 cuotas pagadas', exact: true }).count(), 1);
      }
      assert.deepEqual(errors, []); await context.close();
    }
  } finally { await browser.close(); await fixture.stop(); }
}
