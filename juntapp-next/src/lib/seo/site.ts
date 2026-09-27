export const SITE_URL = 'https://www.juntapp.cl';
export const SITE_NAME = 'JuntAPP';
export const SITE_LOCALE = 'es_CL';
export const CONTENT_UPDATED = '2026-09-26';
export const EDITOR_LABEL = 'Equipo JuntAPP, producto de PuroCode en Chile';
export const CONTACT_EMAIL = 'contacto@juntapp.cl';
export const PUROCODE_URL = 'https://www.purocode.com/';
export const OG_IMAGE_PATH = '/og/juntapp-og.png';
export const SOFTWARE_ID = `${SITE_URL}/#software`;

/** La home posiciona la marca y la gestión digital. El software vive en /software-juntas-de-vecinos. */
export const HOME_TITLE = 'JuntAPP | Gestión digital para juntas de vecinos en Chile';
export const HOME_DESCRIPTION =
  'Gestión digital para juntas de vecinos en Chile. JuntAPP reúne socios, cuotas, tesorería, comunicaciones y consultas de tu comunidad.';

/** Una sola entidad SoftwareApplication, la misma en todas las páginas que la referencian. */
export const SOFTWARE_ENTITY_DESCRIPTION =
  'JuntAPP es el software para juntas de vecinos en Chile. Permite gestionar socios, cuotas, tesorería, comunicaciones y consultas desde la web.';

/**
 * La política de /sitio/[slug] ya está escrita, pero el primer lanzamiento
 * no indexa ninguna página de junta ni la incluye en el sitemap.
 * Pasar a true solo después de revisar sitios reales.
 */
export const COMMUNITY_SITE_INDEXING_ENABLED = false;

/** Solo se bloquea el crawl de la API. Login, dashboard y superadmin usan meta noindex. */
export const ROBOTS_DISALLOW = ['/api/'] as const;

export const DEFAULT_DESCRIPTION = HOME_DESCRIPTION;

export function absoluteUrl(path = '/') {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return new URL(path, SITE_URL).toString();
}
