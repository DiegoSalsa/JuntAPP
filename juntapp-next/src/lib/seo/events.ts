'use client';

import { SEO_EVENTS, type SeoEventDetail, type SeoEventName } from '@/lib/seo/event-names';

export { SEO_EVENTS };
export type { SeoEventDetail, SeoEventName };

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackSeoEvent(name: SeoEventName, detail: SeoEventDetail) {
  if (typeof window === 'undefined') return;
  const payload = { event: name, ...detail };
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push(payload);
  if (typeof window.gtag === 'function') window.gtag('event', name, detail);
}

export function seoEventForHref(href: string | null | undefined): SeoEventName | null {
  if (!href) return null;
  if (href.startsWith('/registro')) return SEO_EVENTS.register;
  if (href.startsWith('/pricing')) return SEO_EVENTS.pricing;
  if (href.startsWith('/contacto')) return SEO_EVENTS.contact;
  if (href.startsWith('/login')) return SEO_EVENTS.login;
  if (href.includes('wa.me/') || href.includes('api.whatsapp.com')) return SEO_EVENTS.whatsapp;
  return null;
}
