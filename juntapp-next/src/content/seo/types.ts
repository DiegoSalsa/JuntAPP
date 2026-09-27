import type { SeoEventName } from '../../lib/seo/event-names';

export type SeoIntent = 'BOFU' | 'MOFU' | 'informacional';
export type SeoSchemaKind = 'software' | 'article' | 'collection';

export type SeoSection = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
  steps?: string[];
  table?: { caption: string; headers: string[]; rows: string[][] };
};

export type SeoFaq = { question: string; answer: string };
export type SeoSource = { label: string; href: string };
export type SeoRelated = { href: string; label: string; description: string };
export type SeoCta = { href: string; label: string; event: SeoEventName; section: string };

export type SeoPageModel = {
  path: string;
  kind: 'commercial' | 'guide' | 'hub';
  keyword: string;
  intent: SeoIntent;
  title: string;
  description: string;
  h1: string;
  plaque: string;
  kicker: string;
  answer: string;
  sections: SeoSection[];
  faqs?: SeoFaq[];
  sources?: SeoSource[];
  cta: SeoCta;
  secondaryCta?: SeoCta;
  related: SeoRelated[];
  breadcrumbs: { name: string; path: string }[];
  schema: SeoSchemaKind;
  showPlans?: boolean;
  groups?: { title: string; intro: string; links: SeoRelated[] }[];
};
