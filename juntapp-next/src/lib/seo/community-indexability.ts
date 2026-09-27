import { DEFAULT_CONTENT, type WebsiteContent } from '../website';

export type CommunityIndexInput = {
  name?: string | null;
  content?: Partial<WebsiteContent> | null;
};

const RUT_PATTERN = /\b\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]\b/;
const GENERIC_NAME = /^(junta de vecinos|mi junta|comunidad|prueba|test|demo|sitio|pagina|página)$/i;

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export function assessCommunityIndexability(page: CommunityIndexInput) {
  const reasons: string[] = [];
  const name = text(page.name);
  const content = { ...DEFAULT_CONTENT, ...(page.content ?? {}) };
  const about = text(content.about);
  const title = text(content.title);
  const subtitle = text(content.subtitle);
  const address = text(content.address);
  const services = Array.isArray(content.services) ? content.services.map((item) => text(item)).filter(Boolean) : [];
  const news = Array.isArray(content.newsItems) ? content.newsItems : [];

  if (name.length < 8) reasons.push('El nombre público es demasiado corto.');
  if (GENERIC_NAME.test(name)) reasons.push('El nombre público es genérico.');
  if (about.length < 180) reasons.push('La descripción propia no alcanza para una página útil.');
  if (about === DEFAULT_CONTENT.about) reasons.push('La descripción sigue siendo el texto de plantilla.');
  if (title.length < 12 || title === DEFAULT_CONTENT.title) reasons.push('El título sigue siendo el de plantilla.');

  const customServices = services.filter((service) => !DEFAULT_CONTENT.services.includes(service));
  const usefulNews = news.filter((item) => text(item?.title).length >= 12 && text(item?.summary).length >= 40);
  const customAddress = address.length >= 12 && address !== DEFAULT_CONTENT.address;
  const customSubtitle = subtitle.length >= 40 && subtitle !== DEFAULT_CONTENT.subtitle;
  const signals = [customServices.length >= 2, usefulNews.length >= 1, customAddress, customSubtitle].filter(Boolean).length;
  if (signals < 2) reasons.push('Falta contenido original suficiente además de la descripción.');

  const blob = [name, about, title, subtitle, address, content.contact, content.news, ...services, ...news.map((item) => `${text(item?.title)} ${text(item?.summary)}`)].join(' ');
  if (RUT_PATTERN.test(blob)) reasons.push('El contenido público parece incluir un RUT.');

  return { indexable: reasons.length === 0, reasons };
}
