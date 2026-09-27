export const PRIMARY_NAV = [
  { href: '/caracteristicas', label: 'Características' },
  { href: '/recursos', label: 'Recursos' },
  { href: '/pricing', label: 'Planes y precios' },
  { href: '/faq', label: 'FAQ' },
  { href: '/sobre-nosotros', label: 'Sobre nosotros' },
  { href: '/contacto', label: 'Contacto' },
] as const;

export const FOOTER_COLUMNS = [
  {
    title: 'Producto',
    links: [
      { href: '/gestion-socios-junta-de-vecinos', label: 'Gestión de socios' },
      { href: '/cuotas-junta-de-vecinos', label: 'Cuotas y tesorería' },
      { href: '/comunicaciones-junta-de-vecinos', label: 'Comunicaciones' },
    ],
  },
  {
    title: 'Recursos',
    links: [
      { href: '/recursos', label: 'Guías para juntas de vecinos' },
      { href: '/recursos/ley-19418-juntas-de-vecinos', label: 'Ley 19.418' },
      { href: '/faq', label: 'Preguntas frecuentes' },
    ],
  },
  {
    title: 'Empresa',
    links: [
      { href: '/sobre-nosotros', label: 'Sobre JuntAPP' },
      { href: '/pricing', label: 'Precios' },
      { href: '/contacto', label: 'Contacto' },
    ],
  },
] as const;
