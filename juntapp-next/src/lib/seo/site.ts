export const SITE_URL = 'https://www.juntapp.cl';
export const SITE_NAME = 'JuntAPP';
export const SITE_LOCALE = 'es_CL';
export const CONTENT_UPDATED = '2026-09-26';
export const EDITOR_LABEL = 'Equipo JuntAPP, producto de PuroCode en Chile';
export const CONTACT_EMAIL = 'contacto@juntapp.cl';
export const PUROCODE_URL = 'https://www.purocode.com/';
export const OG_IMAGE_PATH = '/icons/pwa/icon-512.png';

export const DEFAULT_DESCRIPTION =
  'Software para juntas de vecinos en Chile. Administra socios, cuotas, tesorería, comunicaciones, consultas y la gestión de tu comunidad desde una sola plataforma.';

export function absoluteUrl(path = '/') {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return new URL(path, SITE_URL).toString();
}
