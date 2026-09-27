import type { SeoPageModel } from './types';
import { SEO_EVENTS } from '../../lib/seo/event-names';

export const RESOURCE_HUB: SeoPageModel = {
  path: '/recursos',
  kind: 'hub',
  keyword: 'guías para juntas de vecinos',
  intent: 'informacional',
  title: 'Guías para juntas de vecinos en Chile',
  description: 'Guías claras para directivas de juntas de vecinos en Chile: socios, cuotas, rendiciones, asambleas, actas, elecciones y Ley 19.418.',
  h1: 'Guías para juntas de vecinos',
  plaque: 'JUNTAPP · RECURSOS',
  kicker: 'Centro de gestión vecinal',
  answer: 'Estas guías están escritas para quien dirige una junta de vecinos en Chile. Cada una responde una tarea concreta y, al final, muestra qué parte de esa tarea puede ordenar JuntAPP. No son un blog genérico ni una interpretación legal cerrada.',
  sections: [],
  groups: [
    {
      title: 'Socios y padrón',
      intro: 'Primero la nómina. Sin saber quién es socio, la cuota y la elección se discuten a ciegas.',
      links: [
        { href: '/recursos/como-llevar-registro-socios-junta-de-vecinos', label: 'Cómo llevar el registro de socios', description: 'Qué anotar y qué no publicar.' },
        { href: '/gestion-socios-junta-de-vecinos', label: 'Gestionarlo en JuntAPP', description: 'Padrón, RUT y solicitudes de ingreso.' },
        { href: '/libro-socios-digital', label: 'Libro de socios digital', description: 'El padrón operativo, no un libro foliado.' },
      ],
    },
    {
      title: 'Cuotas y tesorería',
      intro: 'El cobro y la rendición son conversaciones distintas. Una deja el pago registrado. La otra explica el período.',
      links: [
        { href: '/recursos/como-cobrar-cuotas-junta-de-vecinos', label: 'Cómo cobrar las cuotas', description: 'Acuerdo, registro y medios de pago.' },
        { href: '/recursos/rendicion-cuentas-junta-de-vecinos', label: 'Rendición de cuentas', description: 'Qué mostrar y qué documento guardar.' },
        { href: '/recursos/transparencia-junta-de-vecinos', label: 'Transparencia vecinal', description: 'Qué puede ver el socio y qué no va a internet.' },
        { href: '/cuotas-junta-de-vecinos', label: 'Módulo de cuotas', description: 'Estado por domicilio y libro de caja.' },
      ],
    },
    {
      title: 'Asambleas, actas y directiva',
      intro: 'La plataforma puede avisar y archivar. El acuerdo sigue naciendo en la asamblea y en el acta.',
      links: [
        { href: '/recursos/asamblea-junta-de-vecinos', label: 'Asamblea de la junta', description: 'Ordinaria, extraordinaria y citación.' },
        { href: '/recursos/acta-junta-de-vecinos', label: 'Acta de la junta', description: 'Qué dejar escrito después de la reunión.' },
        { href: '/recursos/elecciones-junta-de-vecinos', label: 'Elecciones', description: 'Lo que la guía de la BCN pide informar.' },
        { href: '/recursos/directiva-junta-de-vecinos', label: 'Directiva', description: 'Presidencia, secretaría y tesorería.' },
      ],
    },
    {
      title: 'Marco y digitalización',
      intro: 'La ley dice qué es una junta. Digitalizar es elegir qué proceso sale del cuaderno, no abrir una página por comuna.',
      links: [
        { href: '/recursos/ley-19418-juntas-de-vecinos', label: 'Ley 19.418', description: 'Lectura práctica con fuentes oficiales.' },
        { href: '/recursos/digitalizar-junta-de-vecinos', label: 'Digitalizar la junta', description: 'Por dónde empezar sin botar el archivo físico.' },
        { href: '/software-juntas-de-vecinos', label: 'Software JuntAPP', description: 'La herramienta, cuando la guía ya resolvió la duda.' },
      ],
    },
  ],
  cta: { href: '/registro', label: 'Digitalizar mi junta', event: SEO_EVENTS.register, section: 'recursos' },
  secondaryCta: { href: '/pricing', label: 'Ver planes', event: SEO_EVENTS.pricing, section: 'recursos' },
  related: [],
  breadcrumbs: [],
  schema: 'collection',
};
