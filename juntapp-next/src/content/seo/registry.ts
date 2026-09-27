import { COMMERCIAL_PAGES } from './commercial';
import { GUIDE_PAGES } from './guides';
import { RESOURCE_HUB } from './hub';
import type { SeoPageModel } from './types';

export const SEO_PAGES: SeoPageModel[] = [RESOURCE_HUB, ...COMMERCIAL_PAGES, ...GUIDE_PAGES];

export function requireSeoPage(path: string) {
  const page = SEO_PAGES.find((item) => item.path === path);
  if (!page) throw new Error(`Página SEO no registrada: ${path}`);
  return page;
}

export const SITEMAP_PATHS: { path: string; priority: number }[] = [
  { path: '/', priority: 1 },
  { path: '/software-juntas-de-vecinos', priority: 0.9 },
  { path: '/gestion-socios-junta-de-vecinos', priority: 0.8 },
  { path: '/cuotas-junta-de-vecinos', priority: 0.8 },
  { path: '/tesoreria-junta-de-vecinos', priority: 0.8 },
  { path: '/comunicaciones-junta-de-vecinos', priority: 0.7 },
  { path: '/consultas-votaciones-junta-de-vecinos', priority: 0.7 },
  { path: '/libro-socios-digital', priority: 0.7 },
  { path: '/caracteristicas', priority: 0.6 },
  { path: '/pricing', priority: 0.8 },
  { path: '/recursos', priority: 0.8 },
  ...GUIDE_PAGES.map((page) => ({ path: page.path, priority: 0.6 })),
  { path: '/faq', priority: 0.5 },
  { path: '/sobre-nosotros', priority: 0.4 },
  { path: '/contacto', priority: 0.4 },
  { path: '/legal', priority: 0.2 },
];
