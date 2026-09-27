export const SEO_EVENTS = {
  register: 'seo_register_click',
  pricing: 'seo_pricing_click',
  contact: 'seo_contact_click',
  login: 'seo_login_click',
  whatsapp: 'seo_whatsapp_click',
} as const;

export type SeoEventName = (typeof SEO_EVENTS)[keyof typeof SEO_EVENTS];

export type SeoEventDetail = {
  page: string;
  cta: string;
  source_section: string;
};
