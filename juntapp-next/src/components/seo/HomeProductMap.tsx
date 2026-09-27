import Link from 'next/link';
import TrackedLink from '@/components/seo/TrackedLink';
import { SEO_EVENTS } from '@/lib/seo/event-names';

const links = [
  { href: '/software-juntas-de-vecinos', title: 'Software para juntas de vecinos', text: 'Qué cubre la plataforma y qué no promete.' },
  { href: '/gestion-socios-junta-de-vecinos', title: 'Padrón de socios', text: 'RUT, dirección, solicitudes y cargos.' },
  { href: '/cuotas-junta-de-vecinos', title: 'Cuotas por domicilio', text: 'Al día, pendiente y el ingreso en caja.' },
  { href: '/tesoreria-junta-de-vecinos', title: 'Tesorería', text: 'Movimientos del mes y documentos.' },
  { href: '/comunicaciones-junta-de-vecinos', title: 'Avisos a los vecinos', text: 'Comunicados y notificación al celular.' },
  { href: '/recursos', title: 'Guías para la directiva', text: 'Socios, cuotas, actas y Ley 19.418.' },
];

export default function HomeProductMap() {
  return (
    <section className="landing-section subpage-mural-section home-seo-band" aria-labelledby="mapa-juntapp">
      <div className="landing-container">
        <div className="subpage-corkboard-container seo-growth">
          <div className="corkboard-brass-plaque">JUNTAPP · POR DÓNDE SEGUIR</div>
          <div className="seo-paper">
            <p className="seo-kicker">Mapa del producto</p>
            <h2 id="mapa-juntapp">Elige la tarea de tu directiva</h2>
            <p>Esta página presenta la gestión digital de JuntAPP. El detalle del producto, para quien busca un software, una app o un sistema para su junta, está en la primera ficha.</p>
            <ul className="seo-note-list">
              {links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}><strong>{link.title}</strong><span>{link.text}</span></Link>
                </li>
              ))}
            </ul>
            <aside className="seo-cta">
              <p>Si ya sabes que quieres sacar el padrón del cuaderno, crea la junta.</p>
              <div>
                <TrackedLink href="/registro" className="btn btn-primary btn-orange" event={SEO_EVENTS.register} cta="Digitalizar mi junta" sourceSection="home-mapa">Digitalizar mi junta</TrackedLink>
                <TrackedLink href="/pricing" className="btn btn-ghost" event={SEO_EVENTS.pricing} cta="Ver planes" sourceSection="home-mapa">Ver planes</TrackedLink>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
}
