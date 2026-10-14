export type WebsiteTemplate =
  | 'comunidad'
  | 'mural'
  | 'institucional'
  | 'noticias'
  | 'minimalista'
  | 'editorial'
  | 'fotografica'
  | 'barrio'
  | 'agenda'
  | 'clasica'
  | 'portal';
export type WebsiteNewsItem = { id: string; title: string; summary: string; date: string; category: string; image: string };
export type WebsiteContent = { title: string; subtitle: string; aboutTitle: string; about: string; servicesTitle: string; services: string[]; newsTitle: string; news: string; newsItems: WebsiteNewsItem[]; contactTitle: string; contact: string; address: string; whatsapp: string; facebook: string; instagram: string };
export type WebsiteTheme = { primary: string; accent: string; background: string; text: string };
export const DEFAULT_CONTENT: WebsiteContent = { title: 'Juntos hacemos comunidad', subtitle: 'Información, actividades y noticias de nuestra junta de vecinos.', aboutTitle: 'Nuestra junta', about: 'Somos una comunidad organizada que trabaja por un barrio más seguro, participativo y acogedor.', servicesTitle: 'Lo que hacemos', services: ['Actividades comunitarias','Apoyo a vecinos','Mejoramiento del barrio'], newsTitle: 'Noticias del barrio', news: 'Conoce las actividades, avances y avisos de nuestra comunidad.', newsItems: [], contactTitle: 'Hablemos', contact: 'Escríbenos para participar o resolver tus dudas.', address: 'Sede vecinal', whatsapp: '', facebook: '', instagram: '' };
export const DEFAULT_THEME: WebsiteTheme = { primary: '#0b3b60', accent: '#f97316', background: '#fffaf0', text: '#172033' };

export const WEBSITE_PALETTES: { name: string; colors: WebsiteTheme }[] = [
  { name: 'Bosque', colors: { primary: '#244d3c', accent: '#e8b568', background: '#f8f7f2', text: '#20332a' } },
  { name: 'Costa', colors: { primary: '#174e68', accent: '#f2bd83', background: '#f5f9fa', text: '#1b3542' } },
  { name: 'Terracota', colors: { primary: '#843e30', accent: '#e6bf78', background: '#fbf5ee', text: '#382b28' } },
  { name: 'Lavanda', colors: { primary: '#51436b', accent: '#ded2ee', background: '#faf8fc', text: '#302b3a' } },
  { name: 'Vecinal', colors: DEFAULT_THEME },
];

export const WEBSITE_TEMPLATES: { id: WebsiteTemplate; name: string; note: string; group: 'Comunidad' | 'Información' | 'Imagen'; palette: number }[] = [
  { id: 'comunidad', name: 'Comunidad', note: 'Una bienvenida cálida, con espacio para tu barrio.', group: 'Comunidad', palette: 0 },
  { id: 'editorial', name: 'Revista barrial', note: 'Grandes titulares y noticias con protagonismo.', group: 'Información', palette: 2 },
  { id: 'fotografica', name: 'Fotográfica', note: 'Una portada inmersiva para tus fotografías.', group: 'Imagen', palette: 1 },
  { id: 'minimalista', name: 'Esencial', note: 'Una composición limpia, tranquila y directa.', group: 'Imagen', palette: 3 },
  { id: 'barrio', name: 'Barrio vivo', note: 'Tarjetas, formas y una comunidad con personalidad.', group: 'Comunidad', palette: 2 },
  { id: 'institucional', name: 'Institucional', note: 'Navegación lateral y presencia formal.', group: 'Información', palette: 1 },
  { id: 'noticias', name: 'Noticias', note: 'La actualidad del barrio en primera plana.', group: 'Información', palette: 4 },
  { id: 'agenda', name: 'Agenda vecinal', note: 'Noticias ordenadas por fecha e iniciativas en lista.', group: 'Información', palette: 3 },
  { id: 'clasica', name: 'Clásica', note: 'Tipografía editorial y una portada centrada.', group: 'Imagen', palette: 0 },
  { id: 'portal', name: 'Portal ciudadano', note: 'Accesos directos e información a mano.', group: 'Información', palette: 1 },
  { id: 'mural', name: 'Mural vecinal', note: 'Notas de color sobre un tablero de comunidad.', group: 'Comunidad', palette: 2 },
];

export function normalizeWebsiteContent(value?: Partial<WebsiteContent> | null): WebsiteContent {
  const source = value ?? {};
  const result = { ...DEFAULT_CONTENT };
  for (const key of Object.keys(DEFAULT_CONTENT) as (keyof WebsiteContent)[]) {
    if (key !== 'services' && key !== 'newsItems' && typeof source[key] === 'string') {
      (result[key] as string) = source[key] as string;
    }
  }
  result.services = Array.isArray(source.services) ? source.services.filter((item) => typeof item === 'string').slice(0, 6) : [...DEFAULT_CONTENT.services];
  result.newsItems = Array.isArray(source.newsItems) ? source.newsItems.filter((item) => item && typeof item.title === 'string').slice(0, 12).map((item, index) => ({
    id: typeof item.id === 'string' ? item.id : `news-${index}`,
    title: item.title, summary: typeof item.summary === 'string' ? item.summary : '',
    date: typeof item.date === 'string' ? item.date : '', category: typeof item.category === 'string' ? item.category : 'Comunidad',
    image: typeof item.image === 'string' ? item.image : '',
  })) : [];
  return result;
}

export function normalizeWebsiteTheme(value?: Partial<WebsiteTheme> | null): WebsiteTheme {
  const result = { ...DEFAULT_THEME };
  for (const key of Object.keys(result) as (keyof WebsiteTheme)[]) {
    if (typeof value?.[key] === 'string' && /^#[\da-f]{6}$/i.test(value[key])) result[key] = value[key];
  }
  return result;
}

export function readableColor(background: string) {
  const channels = [1, 3, 5].map((index) => {
    const value = parseInt(background.slice(index, index + 2), 16) / 255;
    return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
  });
  const luminance = channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
  return luminance > .179 ? '#000000' : '#ffffff';
}

export function websiteImageUrl(value?: string | null) {
  if (!value) return '';
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
}

export function websiteSocialUrl(value: string, network: 'facebook' | 'instagram') {
  const clean = value.trim().replace(/^@/, '');
  if (!clean) return '';
  const candidate = /^https?:\/\//i.test(clean) ? clean : /^(?:www\.)?(?:facebook|instagram)\.com\//i.test(clean) ? `https://${clean}` : `https://www.${network}.com/${clean.replace(/^\/+|\/+$/g, '')}`;
  try {
    const url = new URL(candidate);
    return ['http:', 'https:'].includes(url.protocol) && (url.hostname === `${network}.com` || url.hostname.endsWith(`.${network}.com`)) ? url.href : '';
  } catch { return ''; }
}
