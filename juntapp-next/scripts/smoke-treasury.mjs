import { chromium } from 'playwright-core';

const baseUrl = process.env.JUNTAPP_TEST_URL ?? 'http://localhost:3000';
const users = [
  { email: 'directiva.demo@juntapp.cl', password: 'DirectivaDemo2026!', dirigente: true },
  { email: 'vecino.demo@juntapp.cl', password: 'VecinoDemo2026!', dirigente: false },
];
const viewports = [
  { name: 'desktop', width: 1366, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

const browser = await chromium.launch({
  headless: true,
});

try {
  for (const viewport of viewports) {
    for (const user of users) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      const errors = [];
      page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('response', (response) => { if (response.status() >= 400 && !response.url().endsWith('/api/treasury/mercadopago/sync')) errors.push(`HTTP ${response.status()} ${response.url()}`); });

      await page.goto(`${baseUrl}/login`);
      await page.locator('#email').fill(user.email);
      await page.locator('#password').fill(user.password);
      await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
      await page.waitForURL('**/inicio');
      await page.goto(`${baseUrl}/tesoreria`, { waitUntil: 'networkidle' });

      await page.getByRole('heading', { name: 'Tesorería Transparente' }).waitFor();
      await page.getByText('Caja Disponible Actual', { exact: true }).waitFor();
      await page.getByRole('heading', { name: 'Libro de Caja Reciente' }).waitFor();

      const registerCount = await page.getByRole('button', { name: /Registrar Movimiento/ }).count();
      const reconciliationCount = await page.getByText('Recaudación y conciliación automática', { exact: true }).count();
      if (user.dirigente && (!registerCount || !reconciliationCount)) throw new Error(`${user.email}: faltan controles de directiva.`);
      if (!user.dirigente && (registerCount || reconciliationCount)) throw new Error(`${user.email}: recibió controles reservados a la directiva.`);

      if (viewport.name === 'desktop') {
        const syncResponse = await page.evaluate(async () => {
          const response = await fetch('/api/treasury/mercadopago/sync', { method: 'POST' });
          return { status: response.status, body: await response.json() };
        });
        if (!user.dirigente && syncResponse.status !== 403) throw new Error(`${user.email}: el endpoint de conciliación no rechazó al vecino.`);
        const disconnected = await page.getByText('Mercado Pago: Sin conectar', { exact: true }).count();
        if (user.dirigente && disconnected && ![403, 502].includes(syncResponse.status)) throw new Error(`${user.email}: la cuenta desconectada devolvió HTTP ${syncResponse.status}: ${JSON.stringify(syncResponse.body)}.`);
        for (let index = errors.length - 1; index >= 0; index -= 1) {
          if (/Failed to load resource.*(?:403|502)/.test(errors[index])) errors.splice(index, 1);
        }
      }

      await page.getByRole('button', { name: 'Generar Reporte Mensual' }).click();
      const report = page.getByRole('dialog');
      await report.getByText('Ingresos brutos del mes', { exact: true }).waitFor();
      await report.getByText('Gastos y comisiones del mes', { exact: true }).waitFor();
      await report.getByText('Variación neta del mes', { exact: true }).waitFor();
      await report.getByRole('button', { name: 'Cerrar', exact: true }).click();

      const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
      if (overflow > 2) throw new Error(`${user.email}: desborde horizontal de ${overflow}px en ${viewport.name}.`);
      if (errors.length) throw new Error(`${user.email}: errores de consola: ${errors.join(' | ')}`);

      console.log(JSON.stringify({ ui: 'OK', viewport: viewport.name, role: user.dirigente ? 'dirigente' : 'vecino', overflow }));
      await context.close();
    }
  }
} finally {
  await browser.close();
}
