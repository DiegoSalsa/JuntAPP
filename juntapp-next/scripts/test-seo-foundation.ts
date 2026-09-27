import assert from 'node:assert/strict';
import { assessCommunityIndexability } from '../src/lib/seo/community-indexability';
import { SEO_PAGES, SITEMAP_PATHS } from '../src/content/seo/registry';
import { COMMUNITY_SITE_INDEXING_ENABLED, HOME_TITLE, ROBOTS_DISALLOW } from '../src/lib/seo/site';
import { DEFAULT_CONTENT } from '../src/lib/website';

const blocked = assessCommunityIndexability({
  name: 'Junta de prueba',
  content: DEFAULT_CONTENT,
});
assert.equal(blocked.indexable, false);

const thin = assessCommunityIndexability({
  name: 'Junta de Vecinos Los Arrayanes',
  content: {
    ...DEFAULT_CONTENT,
    title: 'Arrayanes informa a su barrio',
    about: 'Somos la junta de vecinos de Los Arrayanes. Esta descripción propia cuenta cómo organizamos la sede, las actividades del fin de semana y el cuidado de la plaza. Trabajamos con los vecinos que viven en el sector y publicamos solo información que la directiva revisó.',
  },
});
assert.equal(thin.indexable, false);

const indexable = assessCommunityIndexability({
  name: 'Junta de Vecinos Los Arrayanes',
  content: {
    ...DEFAULT_CONTENT,
    title: 'Arrayanes, barrio que se organiza',
    subtitle: 'Avisos, sede y actividades de la junta de vecinos Los Arrayanes.',
    about: 'La Junta de Vecinos Los Arrayanes reúne a las familias del sector oriente de la población. Cuidamos la sede de calle Los Boldos, organizamos la limpieza de la plaza y publicamos los acuerdos que la directiva ya comunicó en asamblea. Esta descripción fue escrita por la propia junta.',
    services: ['Sede vecinal de calle Los Boldos', 'Cuadrilla de plaza los sábados'],
    address: 'Sede Los Boldos 1450, esquina Los Olmos',
    newsItems: [{
      id: '1',
      title: 'Asamblea de octubre en la sede',
      summary: 'La directiva cita a socios el sábado 4 de octubre a las 11:00 en la sede de Los Boldos para informar la cuenta del trimestre.',
      date: '2026-10-04',
      category: 'Asamblea',
      image: '',
    }],
  },
});
assert.equal(indexable.indexable, true, indexable.reasons.join(' '));

const withRut = assessCommunityIndexability({
  name: 'Junta de Vecinos Los Arrayanes',
  content: { ...indexable ? DEFAULT_CONTENT : DEFAULT_CONTENT, about: 'Socio de ejemplo 12.345.678-5 vive en el pasaje y su ficha no debe indexarse junto con el resto de la descripción larga de la comunidad que escribe su historia vecinal con detalle suficiente para superar el mínimo.' },
});
assert.equal(withRut.indexable, false);

const keywords = new Set<string>();
const paths = new Set<string>();
for (const page of SEO_PAGES) {
  assert.equal(keywords.has(page.keyword), false, page.keyword);
  assert.equal(paths.has(page.path), false, page.path);
  keywords.add(page.keyword);
  paths.add(page.path);
  assert.equal(page.h1.length > 10, true);
  assert.equal(page.description.length > 80 && page.description.length < 180, true, `${page.path} description ${page.description.length}`);
  assert.ok(page.answer.split(/\s+/).length >= 35, page.path);
}

const privatePaths = ['/login', '/registro', '/inicio', '/socios', '/superadmin', '/api'];
for (const path of privatePaths) assert.equal(SITEMAP_PATHS.some((item) => item.path === path), false, path);
assert.equal(SITEMAP_PATHS.some((item) => item.path.startsWith('/sitio/')), false);

assert.equal(HOME_TITLE, 'JuntAPP | Gestión digital para juntas de vecinos en Chile');
assert.equal(HOME_TITLE.toLowerCase().includes('software para juntas'), false);
assert.equal(SEO_PAGES.find((page) => page.keyword === 'software para juntas de vecinos')?.path, '/software-juntas-de-vecinos');
assert.equal(SEO_PAGES.filter((page) => page.keyword === 'software para juntas de vecinos').length, 1);
assert.deepEqual([...ROBOTS_DISALLOW], ['/api/']);
assert.equal(COMMUNITY_SITE_INDEXING_ENABLED, false);

const socios = SEO_PAGES.find((page) => page.path === '/gestion-socios-junta-de-vecinos');
const registro = SEO_PAGES.find((page) => page.path === '/recursos/como-llevar-registro-socios-junta-de-vecinos');
const cuotas = SEO_PAGES.find((page) => page.path === '/recursos/como-cobrar-cuotas-junta-de-vecinos');
const sociosText = JSON.stringify(socios);
const registroText = JSON.stringify(registro);
const cuotasText = JSON.stringify(cuotas);
assert.equal(sociosText.includes('selección discrecional'), true);
assert.equal(sociosText.includes('no permite negar el ingreso'), true);
assert.equal(registroText.includes('no puede ser rechazado por preferencia'), true);
assert.equal(cuotasText.includes('Cobra por domicilio si así lo decidieron'), false);
assert.equal(cuotasText.includes('estatutos y acuerdos vigentes'), true);
assert.equal(cuotasText.includes('no una regla de la Ley 19.418'), true);

console.log(`seo foundation ok: ${SEO_PAGES.length} páginas`);
