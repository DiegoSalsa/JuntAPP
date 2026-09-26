import { chromium } from 'playwright-core';

const baseUrl = process.env.JUNTAPP_TEST_URL ?? 'http://localhost:3100';
const cases = [
  {
    email: 'directiva.demo@juntapp.cl',
    password: 'DirectivaDemo2026!',
    label: 'Mi Página Web',
    destination: '/mi-pagina',
    expectsBuilder: true,
  },
  {
    email: 'vecino.demo@juntapp.cl',
    password: 'VecinoDemo2026!',
    label: 'Web de la Junta',
    destination: '/sitio/junta-migrada',
    expectsBuilder: false,
  },
];

const browser = await chromium.launch({
  headless: true,
});

try {
  for (const test of cases) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${baseUrl}/login`);
    await page.locator('#email').fill(test.email);
    await page.locator('#password').fill(test.password);
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
    await page.waitForURL('**/inicio');

    const websiteNavigation = page.locator('#nav-mi-pagina');
    await websiteNavigation.waitFor({ state: 'visible' });
    const label = (await websiteNavigation.textContent())?.trim();
    if (label !== test.label) {
      throw new Error(`${test.email}: se esperaba “${test.label}”, se obtuvo “${label}”.`);
    }
    if (await websiteNavigation.evaluate((element) => element.tagName) !== 'A') {
      throw new Error(`${test.email}: la navegación web no es un enlace semántico.`);
    }
    const linkedPath = new URL(await websiteNavigation.getAttribute('href'), baseUrl).pathname;
    if (linkedPath !== test.destination) {
      throw new Error(`${test.email}: el enlace apunta a “${linkedPath}” en vez de “${test.destination}”.`);
    }

    await websiteNavigation.click();
    await page.waitForURL((url) => url.pathname === test.destination);
    if (test.expectsBuilder) {
      await page.locator('.builder-shell').waitFor({ state: 'visible' });
    } else if (await page.locator('.builder-shell').count()) {
      throw new Error('El vecino recibió el editor web.');
    }

    console.log(JSON.stringify({
      ui: 'OK',
      email: test.email,
      label,
      destination: new URL(page.url()).pathname,
    }));
    await context.close();
  }
} finally {
  await browser.close();
}
