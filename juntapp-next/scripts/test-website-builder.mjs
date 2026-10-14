import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { chromium, webkit } from 'playwright-core';

// All data and writes stay in this in-memory service, including publication tests.
const serve = process.argv.includes('--serve');
const editorOnly = process.argv.includes('--editor-only');
const artifacts = path.resolve('.test-artifacts/website-builder');
fs.mkdirSync(artifacts, { recursive: true });
const templates = ['comunidad','editorial','fotografica','minimalista','barrio','institucional','noticias','agenda','clasica','portal','mural'];
const junta = { id: '11111111-1111-4111-8111-111111111111', name: 'Junta de Vecinos Los Aromos', slug: 'los-aromos', subscription_status: 'authorized', subscription_plan: 'web', billing_mode: 'subscription' };
const user = { id: '33333333-3333-4333-8333-333333333333', email: 'editor@example.test', role: 'authenticated', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
const accessToken = `${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, email: user.email, exp: Math.floor(Date.now()/1000)+36000, role: 'authenticated' })).toString('base64url')}.mock`;
const initial = {
  junta_id: junta.id, template: 'comunidad', published: true,
  theme: { primary: '#244d3c', accent: '#e8b568', background: '#f8f7f2', text: '#20332a' },
  content: { title: 'Un barrio que construimos juntos.', subtitle: 'Somos Los Aromos. Un lugar para encontrarnos, participar y cuidar lo que nos une.', aboutTitle: 'Aquí, cada vecino cuenta.', about: 'Desde nuestra sede, impulsamos encuentros e iniciativas para hacer del barrio un lugar más acogedor. Creemos en las buenas conversaciones, en las puertas abiertas y en el trabajo de todos.\n\nTe invitamos a ser parte de esta comunidad.', servicesTitle: 'Pequeñas acciones.\nGrandes cambios.', services: ['Encuentros y vida de barrio', 'Un entorno que cuidamos', 'Apoyo entre vecinos'], newsTitle: 'La vida en Los Aromos', news: 'Historias, encuentros y novedades de nuestra comunidad.', newsItems: [
    { id: 'news-1', title: 'Volvemos a encontrarnos en la plaza', summary: 'Una jornada para compartir, conversar y disfrutar de nuestro barrio. Conoce los detalles en la sede vecinal.', category: 'Encuentros', date: '2026-10-18', image: '/marketing/email/comunidad-juntapp.jpg' },
    { id: 'news-2', title: 'Tu idea puede transformar el barrio', summary: 'Abrimos un espacio para escuchar las iniciativas de los vecinos y preparar juntos los próximos proyectos.', category: 'Participación', date: '2026-10-14', image: '/marketing/email/participacion-juntapp.jpg' },
    { id: 'news-3', title: 'Cuidamos nuestros espacios comunes', summary: 'Nos organizamos para mantener los espacios que compartimos. Acércate a la directiva para sumarte.', category: 'Nuestro barrio', date: '2026-10-12', image: '' },
  ], contactTitle: 'Hagamos barrio.', contact: 'Una pregunta, una idea o las ganas de participar. Estamos aquí para escucharte.', address: 'Los Aromos 145, Santiago', whatsapp: '+56 9 1234 5678', facebook: 'losaromos', instagram: '@losaromos' },
  logo_url: null, hero_image_url: '/marketing/email/comunidad-juntapp.jpg', gallery: ['/marketing/email/participacion-juntapp.jpg','/marketing/email/comunidad-juntapp.jpg'],
};
let website = structuredClone(initial);
let failNextWrite = false;
let failWebsiteReads = false;
let writes = [];
let role = 'dirigente';
const mock = createServer(async (req,res) => {
  res.setHeader('Access-Control-Allow-Origin',req.headers.origin ?? '*');
  res.setHeader('Access-Control-Allow-Credentials','true');
  res.setHeader('Access-Control-Allow-Private-Network','true');
  res.setHeader('Access-Control-Allow-Headers',req.headers['access-control-request-headers'] ?? 'authorization, apikey, content-type, x-client-info, prefer, accept');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Content-Type','application/json');
  if(req.method === 'OPTIONS') { res.writeHead(204).end(); return; }
  const url = new URL(req.url,'http://localhost');
  if(url.pathname === '/auth/v1/token') { res.end(JSON.stringify({ access_token:accessToken, token_type:'bearer',expires_in:36000,refresh_token:'mock-refresh',user })); return; }
  if(url.pathname === '/auth/v1/user') { res.end(JSON.stringify(user)); return; }
  if(url.pathname.startsWith('/storage/v1/object/') && url.pathname.includes('/website-media/')) {
    if(req.method === 'POST') { for await (const chunk of req) void chunk; res.end(JSON.stringify({ Key:'website-media/test.webp' })); return; }
    res.setHeader('Content-Type','image/png'); res.end(fs.readFileSync('public/icons/favicon-32x32.png')); return;
  }
  if(url.pathname === '/rest/v1/rpc/get_public_website') {
    let body=''; for await(const chunk of req) body += chunk;
    const slug=JSON.parse(body).p_slug;
    const fixture = slug.startsWith('plantilla-') ? { ...initial, template:slug.slice(10).replace('-sin-foto',''), ...(slug.includes('sin-foto') ? { hero_image_url:null, gallery:[], content:{...initial.content,newsItems:[]} } : {}) } : website.published ? website : null;
    res.end(JSON.stringify(fixture ? { ...fixture, name:junta.name } : null)); return;
  }
  if(url.pathname.startsWith('/rest/v1/')) {
    const table=url.pathname.split('/').pop();
    if(table === 'website_pages' && req.method === 'GET' && failWebsiteReads) { res.writeHead(503).end(JSON.stringify({message:'Mock page read unavailable'})); return; }
    const profile={ id:user.id, name:'Directiva de Los Aromos', rut:'11111111-1', address:'Los Aromos 145', role, board_position:'president', junta_id:junta.id, juntas:junta };
    if(table === 'website_pages' && ['POST','PATCH'].includes(req.method)) {
      let body=''; for await(const chunk of req) body += chunk;
      if(failNextWrite) { failNextWrite=false; res.writeHead(503).end(JSON.stringify({ message:'Mock write unavailable' })); return; }
      const update=JSON.parse(body); writes.push({method:req.method,update}); website={...website,...update}; res.writeHead(201).end(''); return;
    }
    const rows=table === 'profiles' ? [profile] : table === 'website_pages' ? [website] : [];
    if(req.method === 'HEAD') { res.setHeader('Content-Range',`0-0/${rows.length}`); res.end(); return; }
    res.end(JSON.stringify(req.headers.accept?.includes('application/vnd.pgrst.object+json') ? rows[0] ?? null : rows)); return;
  }
  res.writeHead(404).end('{}');
});
mock.listen(0,'127.0.0.1'); await once(mock,'listening');
const mockPort=mock.address().port;
const appPort=serve ? 4317 : 44000+Math.floor(Math.random()*9000);
const appUrl=`http://127.0.0.1:${appPort}`;
const app=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','-p',String(appPort),'-H','127.0.0.1'], { env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:`http://127.0.0.1:${mockPort}`,NEXT_PUBLIC_SUPABASE_ANON_KEY:'mock-anon',SUPABASE_SERVICE_ROLE_KEY:'mock-service',NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe'] });
let output=''; app.stdout.on('data',chunk => output+=chunk); app.stderr.on('data',chunk => output+=chunk);
function cleanup() {
  if(app.exitCode === null) { if(process.platform === 'win32') { try { execFileSync('taskkill',['/pid',String(app.pid),'/T','/F'],{stdio:'ignore'}); } catch {} } else app.kill('SIGTERM'); }
  mock.close();
}
process.once('SIGINT',()=>{cleanup();process.exit(0);}); process.once('SIGTERM',()=>{cleanup();process.exit(0);});
async function waitForApp() {
  for(let index=0;index<100;index++) { try { if((await fetch(`${appUrl}/login`)).ok)return; } catch {} await new Promise(resolve=>setTimeout(resolve,500)); }
  throw new Error(`App did not start:\n${output.slice(-4000)}`);
}
async function checkBounds(page,label) {
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
  assert.ok(overflow<=2,`${label}: page overflow ${overflow}`);
  const escaped=await page.locator('.site-hero-copy,.site-service-grid,.site-news-grid,.site-contact address,.site-brand').evaluateAll(elements=>elements.filter(element=>{const rect=element.getBoundingClientRect();return rect.width>0&&(rect.left < -2 || rect.right > innerWidth+2);}).map(element=>element.className));
  assert.deepEqual(escaped,[],`${label}: content outside viewport`);
}
async function login(page) {
  await page.goto(`${appUrl}/login`);
  await page.waitForLoadState('networkidle');
  await page.locator('#email').fill(user.email); await page.locator('#password').fill('TestPassword123!');
  await page.getByRole('button',{name:'Ingresar',exact:true}).click();
  try { await page.waitForURL('**/mi-pagina',{timeout:45000}); }
  catch(error) { console.error('Login diagnostic',{ url:page.url(), message:await page.locator('.auth-error-message').allTextContents() }); await page.screenshot({path:path.join(artifacts,'login-failure.png')}); throw error; }
  await page.getByRole('heading',{name:'Mi página web',exact:true}).waitFor();
}

let browser;
try {
  await waitForApp();
  if(serve) {
    console.log(`LOCAL MOCK PREVIEW ${appUrl}\nEditor: ${appUrl}/login (any password; ${user.email})\nPublic page: ${appUrl}/sitio/los-aromos\nAll changes stay in memory.`);
    await new Promise(()=>{});
  }
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const pageErrors=[]; page.on('pageerror',error=>pageErrors.push(error.message));
  for(const width of editorOnly ? [] : [1280,768,390,320]) {
    await page.setViewportSize({width,height:1000});
    for(const template of templates) {
      await page.goto(`${appUrl}/sitio/plantilla-${template}`);
      await page.locator(`.community-site[data-template="${template}"]`).waitFor();
      await checkBounds(page,`${template}/${width}`);
      assert.equal(await page.locator('h1').count(),1);
      assert.equal(await page.locator('.site-news-card').count(),3);
      const heading=await page.locator('h1').evaluate(element=>({font:getComputedStyle(element).fontFamily,transform:getComputedStyle(element).textTransform}));
      assert.equal(heading.transform,'none',`${template}: legacy uppercase typography leaked`);
      if(width === 390) {
        await page.getByText('Menú',{exact:true}).click();
        assert.equal(await page.locator('.site-mobile-menu').getAttribute('open'),'');
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('.site-mobile-menu').getAttribute('open'),null);
      }
      if(width===1280 && ['comunidad','editorial','fotografica','minimalista','portal'].includes(template)) await page.screenshot({path:path.join(artifacts,`${template}-desktop.png`),fullPage:true});
      if(width===390 && template==='comunidad') await page.screenshot({path:path.join(artifacts,'comunidad-mobile.png'),fullPage:true});
    }
    console.log(`PASS all 11 templates at ${width}px: content bounds, news, typography, navigation`);
  }
  await page.setViewportSize({width:1440,height:1050});
  if(!editorOnly) {
    for(const template of templates) {
      await page.setViewportSize({width:390,height:844});
      await page.goto(`${appUrl}/sitio/plantilla-${template}-sin-foto`);
      await checkBounds(page,`${template}/empty-media`);
      assert.equal(await page.locator('.site-hero-visual .neighborhood-art').count(),1);
      assert.equal(await page.locator('.site-news-empty').isVisible(),true);
    }
    console.log('PASS all 11 templates without uploaded images or news');
    await page.setViewportSize({width:1440,height:1050});
  }
  const notificationRequests=[];
  await page.route('**/api/notifications/push',route=>{notificationRequests.push(JSON.parse(route.request().postData()));return route.fulfill({status:200,contentType:'application/json',body:'{"pushStatus":"queued"}'});});
  await login(page);
  let frame=page.frameLocator('iframe[title="Vista previa del sitio web"]');
  await frame.locator('h1').waitFor();
  await page.screenshot({path:path.join(artifacts,'editor-desktop.png'),fullPage:true});
  await page.getByRole('button',{name:'Móvil',exact:true}).click();
  assert.equal(await frame.locator('body').evaluate(()=>innerWidth),390);
  await frame.getByText('Menú',{exact:true}).click();
  await frame.locator('summary').press('Escape');
  assert.equal(await frame.locator('.site-mobile-menu').getAttribute('open'),null,'preview Escape closes its own menu');
  await page.getByRole('tab',{name:'Textos',exact:true}).click();
  await page.getByLabel('Título principal',{exact:true}).fill('Una comunidad que crece contigo.');
  await frame.getByRole('heading',{name:'Una comunidad que crece contigo.'}).waitFor();
  const services=page.getByLabel('Iniciativas (una por línea)',{exact:true});
  await services.fill('Primera iniciativa\n');
  assert.equal(await services.inputValue(),'Primera iniciativa\n','newlines remain editable');
  await services.pressSequentially('Segunda iniciativa');
  await page.getByRole('button',{name:'Guardar borrador',exact:true}).click();
  await page.getByRole('status').getByText('Borrador guardado.',{exact:false}).waitFor();
  assert.equal(website.published,true,'saving keeps the public site published');
  assert.equal(website.draft_content.services.length,2);
  assert.equal(website.content.title,initial.content.title,'draft saves preserve the public snapshot');
  assert.equal(notificationRequests.length,0,'regular saves do not send announcements');
  await page.getByLabel('Título principal',{exact:true}).fill('Cambio que debe conservarse tras un error.');
  failNextWrite=true;
  await page.getByRole('button',{name:'Guardar borrador',exact:true}).click();
  await page.locator('.builder-message[role="alert"]').waitFor();
  assert.equal(await page.getByLabel('Título principal',{exact:true}).inputValue(),'Cambio que debe conservarse tras un error.');
  assert.equal(await page.getByRole('button',{name:'Guardar borrador',exact:true}).isEnabled(),true);
  await page.getByRole('button',{name:'Guardar borrador',exact:true}).click();
  await page.getByRole('status').waitFor();
  await page.getByRole('button',{name:'Publicar y avisar',exact:true}).click();
  await page.getByRole('status').getByText('El aviso',{exact:false}).waitFor();
  assert.equal(notificationRequests.length,1);
  assert.equal(website.draft_content,null,'publication clears the saved draft');
  assert.equal(website.content.title,'Cambio que debe conservarse tras un error.');
  await page.getByRole('button',{name:'Despublicar página',exact:true}).click();
  await page.getByRole('button',{name:'Despublicar ahora',exact:true}).click();
  await page.getByRole('status').getByText('Página despublicada.',{exact:false}).waitFor();
  assert.equal(website.published,false);
  assert.deepEqual(Object.keys(writes.at(-1).update).sort(),['published','updated_at']);
  const anonymous=await browser.newPage(); const hidden=await anonymous.goto(`${appUrl}/sitio/los-aromos`);
  assert.equal(hidden.status(),404,'unpublished pages are unavailable anonymously'); await anonymous.close();
  await page.getByRole('button',{name:'Publicar página',exact:true}).click();
  await page.getByRole('status').getByText('El aviso',{exact:false}).waitFor();
  await page.reload(); await page.getByRole('tab',{name:'Textos',exact:true}).click();
  await page.frameLocator('iframe').locator('h1').waitFor();
  assert.equal(await page.getByLabel('Título principal',{exact:true}).inputValue(),website.content.title,'saved changes survive reload');
  await page.getByRole('tab',{name:'Noticias',exact:true}).click();
  await page.getByRole('button',{name:'Agregar noticia',exact:true}).click();
  await page.getByRole('button',{name:'Publicar y avisar',exact:true}).click();
  await page.getByRole('alert').getByText('Completa el título',{exact:false}).waitFor();
  assert.equal(website.content.newsItems.length,3,'empty news cannot be published');
  await page.getByRole('button',{name:'Eliminar noticia 1',exact:true}).click();
  await page.getByRole('tab',{name:'Imágenes',exact:true}).click();
  await page.getByLabel('Logo de la junta',{exact:true}).setInputFiles('public/icons/favicon-32x32.png');
  await page.getByRole('status').getByText('Imagen lista.',{exact:false}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Guardar borrador',exact:true}).isEnabled(),true,'saving unlocks after image upload');
  console.log('PASS editor: live mobile preview, multiline editing, save/publication, failed write retry, announcements, unpublish, reload, news validation, upload');
  await page.setViewportSize({width:390,height:844});
  await page.frameLocator('iframe').locator('h1').waitFor();
  await checkBounds(page,'mobile editor');
  await page.screenshot({path:path.join(artifacts,'editor-mobile.png'),fullPage:true});
  assert.deepEqual(pageErrors,[],'client runtime errors');
  const failedReadContext=await browser.newContext({ storageState:await page.context().storageState() });
  const failedRead=await failedReadContext.newPage();
  failWebsiteReads=true;
  await failedRead.goto(`${appUrl}/mi-pagina`);
  await failedRead.getByRole('heading',{name:'No pudimos cargar esta sección'}).waitFor();
  assert.equal(await failedRead.locator('.builder-shell').count(),0,'a read failure never opens an empty editor');
  failWebsiteReads=false;
  await failedReadContext.close();
  console.log('PASS failed page read preserves content and blocks an empty editor');
  await browser.close(); browser=null;
  const safari=await webkit.launch({headless:true});
  const safariPage=await safari.newPage({viewport:{width:390,height:844}});
  await safariPage.goto(`${appUrl}/sitio/plantilla-comunidad`); await checkBounds(safariPage,'WebKit public site');
  await login(safariPage); await safariPage.frameLocator('iframe').locator('h1').waitFor();
  await checkBounds(safariPage,'WebKit editor'); await safari.close();
  console.log('PASS WebKit: public site, login and live editor preview');
  console.log(`Screenshots: ${artifacts}`);
} catch(error) { console.error(output.slice(-5000)); throw error; }
finally { if(browser) await browser.close(); if(!serve) cleanup(); }
