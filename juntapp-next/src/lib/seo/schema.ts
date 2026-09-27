import { formatCLP, PLANS } from '@/lib/plans';
import { absoluteUrl, CONTACT_EMAIL, PUROCODE_URL, SITE_NAME, SITE_URL, SOFTWARE_ENTITY_DESCRIPTION, SOFTWARE_ID } from '@/lib/seo/site';

export type BreadcrumbItem = { name: string; path: string };

export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: absoluteUrl('/icons/pwa/icon-512.png'),
    email: CONTACT_EMAIL,
    description:
      'JuntAPP es un software chileno para la gestión de juntas de vecinos y organizaciones comunitarias: socios, cuotas, tesorería, comunicaciones y consultas.',
    areaServed: { '@type': 'Country', name: 'Chile' },
    brand: { '@type': 'Brand', name: SITE_NAME },
    parentOrganization: {
      '@type': 'Organization',
      name: 'PuroCode',
      url: PUROCODE_URL,
    },
  };
}

export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    inLanguage: 'es-CL',
    publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
  };
}

export function softwareApplicationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    '@id': SOFTWARE_ID,
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    description: SOFTWARE_ENTITY_DESCRIPTION,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    inLanguage: 'es-CL',
    offers: Object.values(PLANS).map((plan) => ({
      '@type': 'Offer',
      name: plan.name,
      price: String(plan.price),
      priceCurrency: 'CLP',
      url: absoluteUrl('/pricing'),
      availability: 'https://schema.org/InStock',
      description: `${formatCLP(plan.price)} CLP al mes, IVA incluido`,
    })),
    provider: { '@type': 'Organization', name: 'PuroCode', url: PUROCODE_URL },
  };
}

export function softwarePageReference(path: string, name: string, description: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    url: absoluteUrl(path),
    name,
    description,
    about: { '@id': SOFTWARE_ID },
    mainEntity: { '@id': SOFTWARE_ID },
  };
}

export function breadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function articleSchema(input: {
  path: string;
  headline: string;
  description: string;
  date: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.headline,
    description: input.description,
    inLanguage: 'es-CL',
    datePublished: input.date,
    dateModified: input.date,
    mainEntityOfPage: absoluteUrl(input.path),
    author: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
      logo: { '@type': 'ImageObject', url: absoluteUrl('/icons/pwa/icon-512.png') },
    },
  };
}

export function schemaGraph(nodes: object[]) {
  return {
    '@context': 'https://schema.org',
    '@graph': nodes.map((node) => {
      const copy = { ...(node as Record<string, unknown>) };
      delete copy['@context'];
      return copy;
    }),
  };
}

export function faqSchema(items: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}
