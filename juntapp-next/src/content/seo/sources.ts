import type { SeoSource } from '@/content/seo/types';

export const BCN_JUNTAS: SeoSource = {
  label: 'Biblioteca del Congreso Nacional. Guía fácil: Juntas de vecinos.',
  href: 'https://www.bcn.cl/leyfacil/recurso/juntas-de-vecinos',
};

export const LEY_CHILE_19418: SeoSource = {
  label: 'Ley Chile. Decreto 58, texto refundido de la Ley 19.418 sobre juntas de vecinos y demás organizaciones comunitarias.',
  href: 'https://www.bcn.cl/leychile/navegar?idNorma=70040',
};

export const SUBDERE_19418: SeoSource = {
  label: 'SUBDERE. Documentación de la Ley 19.418.',
  href: 'https://www.subdere.gov.cl/documentacion/ley-n%C2%B019418-juntas-de-vecinos-y-dem%C3%A1s-organizaciones-comunitarias',
};

export const MANUAL_VILLARRICA: SeoSource = {
  label: 'Municipalidad de Villarrica. Manual de la Ley 19.418 (material municipal, no reemplaza el texto legal).',
  href: 'https://www.munivillarrica.cl/wp-content/uploads/2023/11/manual-_ley-19418.pdf',
};

export const LEGAL_SOURCES = [BCN_JUNTAS, LEY_CHILE_19418, SUBDERE_19418];
