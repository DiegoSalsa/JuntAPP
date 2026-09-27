import Link from 'next/link';
import JsonLd from '@/components/seo/JsonLd';
import PublicChrome from '@/components/seo/PublicChrome';
import RichText from '@/components/seo/RichText';
import TrackedLink from '@/components/seo/TrackedLink';
import type { SeoPageModel } from '@/content/seo/types';
import { formatCLP, PLANS } from '@/lib/plans';
import { articleSchema, breadcrumbSchema, faqSchema, softwareApplicationSchema, softwarePageReference } from '@/lib/seo/schema';
import { CONTENT_UPDATED, EDITOR_LABEL } from '@/lib/seo/site';

function headingId(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

const UPDATED_LABEL = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${CONTENT_UPDATED}T12:00:00Z`));

export default function SeoDocument({ page }: { page: SeoPageModel }) {
  const crumbs = [{ name: 'Inicio', path: '/' }, ...page.breadcrumbs, { name: page.h1, path: page.path }];
  const nodes = [
    breadcrumbSchema(crumbs),
    ...(page.schema === 'software' ? [softwareApplicationSchema(), softwarePageReference(page.path, page.h1, page.description)] : []),
    ...(page.schema === 'article' ? [articleSchema({ path: page.path, headline: page.h1, description: page.description, date: CONTENT_UPDATED })] : []),
    ...(page.faqs?.length ? [faqSchema(page.faqs)] : []),
  ].map((node) => {
    const copy: Record<string, unknown> = { ...(node as Record<string, unknown>) };
    delete copy['@context'];
    return copy;
  });

  return (
    <PublicChrome>
      <JsonLd data={{ '@context': 'https://schema.org', '@graph': nodes }} />
      <section className="landing-section subpage-mural-section">
        <div className="landing-container">
          <div className="subpage-corkboard-container seo-growth">
            <div className="corkboard-brass-plaque">{page.plaque}</div>
            <nav className="seo-breadcrumbs" aria-label="Miga de pan">
              <ol>
                {crumbs.map((crumb, index) => (
                  <li key={crumb.path}>
                    {index < crumbs.length - 1 ? <Link href={crumb.path}>{crumb.name}</Link> : <span aria-current="page">{crumb.name}</span>}
                  </li>
                ))}
              </ol>
            </nav>
            <article className="seo-paper" id="mainContent">
              <p className="seo-kicker">{page.kicker}</p>
              <h1>{page.h1}</h1>
              <p className="seo-meta">Actualizado el <time dateTime={CONTENT_UPDATED}>{UPDATED_LABEL}</time>. {EDITOR_LABEL}.</p>
              <div className="seo-answer"><RichText text={page.answer} /></div>

              {page.groups?.map((group) => (
                <section key={group.title} aria-labelledby={headingId(group.title)}>
                  <h2 id={headingId(group.title)}>{group.title}</h2>
                  <p><RichText text={group.intro} /></p>
                  <ul className="seo-note-list">
                    {group.links.map((link) => (
                      <li key={link.href}>
                        <Link href={link.href}><strong>{link.label}</strong><span>{link.description}</span></Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}

              {page.sections.map((section) => (
                <section key={section.heading} aria-labelledby={headingId(section.heading)}>
                  <h2 id={headingId(section.heading)}>{section.heading}</h2>
                  {section.paragraphs?.map((paragraph) => <p key={paragraph}><RichText text={paragraph} /></p>)}
                  {section.bullets && <ul>{section.bullets.map((item) => <li key={item}><RichText text={item} /></li>)}</ul>}
                  {section.steps && <ol>{section.steps.map((item) => <li key={item}><RichText text={item} /></li>)}</ol>}
                  {section.table && (
                    <div className="seo-table-wrap">
                      <table>
                        <caption>{section.table.caption}</caption>
                        <thead><tr>{section.table.headers.map((header) => <th key={header} scope="col">{header}</th>)}</tr></thead>
                        <tbody>{section.table.rows.map((row) => <tr key={row.join('|')}>{row.map((cell) => <td key={cell}><RichText text={cell} /></td>)}</tr>)}</tbody>
                      </table>
                    </div>
                  )}
                </section>
              ))}

              {page.showPlans && (
                <section aria-labelledby="planes-vigentes">
                  <h2 id="planes-vigentes">Precios vigentes</h2>
                  <p><RichText text="Estos son los precios publicados hoy en {/pricing|Planes y precios}. Están en pesos chilenos e incluyen IVA. El envío masivo por WhatsApp aparece en el producto como próximamente y no es un cobro activo." /></p>
                  <div className="seo-table-wrap">
                    <table>
                      <caption>Planes mensuales de JuntAPP</caption>
                      <thead><tr><th scope="col">Plan</th><th scope="col">Precio mensual</th><th scope="col">Incluye</th></tr></thead>
                      <tbody>
                        <tr><td>{PLANS.juntapp.name}</td><td>${formatCLP(PLANS.juntapp.price)}</td><td>Socios, tesorería, consultas y comunicaciones</td></tr>
                        <tr><td>{PLANS.juntapp_web.name}</td><td>${formatCLP(PLANS.juntapp_web.price)}</td><td>Todo lo anterior y la página pública de la junta</td></tr>
                        <tr><td>{PLANS.web.name}</td><td>${formatCLP(PLANS.web.price)}</td><td>Solo la página pública autoadministrable</td></tr>
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {page.faqs && page.faqs.length > 0 && (
                <section aria-labelledby="preguntas-frecuentes">
                  <h2 id="preguntas-frecuentes">Preguntas frecuentes</h2>
                  <div className="seo-faq">
                    {page.faqs.map((item) => (
                      <details key={item.question}>
                        <summary>{item.question}</summary>
                        <p><RichText text={item.answer} /></p>
                      </details>
                    ))}
                  </div>
                </section>
              )}

              {page.sources && page.sources.length > 0 && (
                <section aria-labelledby="fuentes">
                  <h2 id="fuentes">Fuentes</h2>
                  <ul className="seo-sources">
                    {page.sources.map((source) => <li key={source.href}><a href={source.href} target="_blank" rel="noopener noreferrer">{source.label}</a></li>)}
                  </ul>
                  <p>Esta página ordena información pública para una directiva. No reemplaza los estatutos de la junta, el trámite municipal ni una asesoría jurídica.</p>
                </section>
              )}

              <aside className="seo-cta" aria-label="Siguiente paso">
                <p>Si esta información describe el trabajo de tu directiva, el siguiente paso es probarlo con los datos de tu junta.</p>
                <div>
                  <TrackedLink href={page.cta.href} className="btn btn-primary btn-orange" event={page.cta.event} cta={page.cta.label} sourceSection={page.cta.section}>{page.cta.label}</TrackedLink>
                  {page.secondaryCta && <TrackedLink href={page.secondaryCta.href} className="btn btn-ghost" event={page.secondaryCta.event} cta={page.secondaryCta.label} sourceSection={page.secondaryCta.section}>{page.secondaryCta.label}</TrackedLink>}
                </div>
              </aside>

              {page.related.length > 0 && (
                <section aria-labelledby="seguir-leyendo">
                  <h2 id="seguir-leyendo">Sigue por aquí</h2>
                  <ul className="seo-note-list">
                    {page.related.map((link) => (
                      <li key={link.href}><Link href={link.href}><strong>{link.label}</strong><span>{link.description}</span></Link></li>
                    ))}
                  </ul>
                </section>
              )}
            </article>
          </div>
        </div>
      </section>
    </PublicChrome>
  );
}
