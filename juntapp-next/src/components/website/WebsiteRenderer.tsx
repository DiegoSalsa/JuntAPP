/* Images belong to a dynamic, user-managed Supabase media library. */
/* eslint-disable @next/next/no-img-element */
import type { CSSProperties } from 'react';
import { FaFacebookF, FaInstagram, FaWhatsapp } from 'react-icons/fa6';
import { FiArrowDown, FiArrowUpRight, FiCalendar, FiHeart, FiMapPin, FiUsers } from 'react-icons/fi';
import { normalizeWebsiteContent, normalizeWebsiteTheme, readableColor, websiteImageUrl, websiteSocialUrl, WEBSITE_TEMPLATES, type WebsiteContent, type WebsiteTemplate, type WebsiteTheme } from '@/lib/website';
import GalleryCarousel from './GalleryCarousel';
import MobileSiteMenu from './MobileSiteMenu';
import NeighborhoodArt from './NeighborhoodArt';

export type WebsiteRendererProps = { name: string; template: WebsiteTemplate; content: WebsiteContent; theme: WebsiteTheme; logo?: string | null; hero?: string | null; gallery?: string[] };

function newsDate(value: string, short = false) {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? 'Comunidad' : new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: short ? 'short' : 'long', ...(!short && { year: 'numeric' }) }).format(date);
}

export default function WebsiteRenderer(props: WebsiteRendererProps) {
  const { name } = props;
  const template = WEBSITE_TEMPLATES.some((item) => item.id === props.template) ? props.template : 'comunidad';
  const content = normalizeWebsiteContent(props.content);
  const theme = normalizeWebsiteTheme(props.theme);
  const logo = websiteImageUrl(props.logo);
  const hero = websiteImageUrl(props.hero);
  const gallery = (props.gallery ?? []).map(websiteImageUrl).filter(Boolean).slice(0, 6);
  const style = {
    '--site-primary': theme.primary, '--site-accent': theme.accent, '--site-bg': theme.background, '--site-text': theme.text,
    '--site-on-primary': readableColor(theme.primary), '--site-on-accent': readableColor(theme.accent),
  } as CSSProperties;
  const monogram = name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase() || 'JV';
  const news = template === 'agenda' ? [...content.newsItems].sort((a, b) => b.date.localeCompare(a.date)) : content.newsItems;
  const latest = news[0];
  const isInformation = ['noticias', 'agenda', 'portal'].includes(template);
  const navigation = [['#nosotros', 'Nosotros'], ...(content.services.length ? [['#servicios', 'Iniciativas']] : []), ...(gallery.length ? [['#galeria', 'Galería']] : []), ['#noticias', 'Noticias'], ['#contacto', 'Contacto']] as [string, string][];
  const whatsappDigits = content.whatsapp.replace(/\D/g, '');
  const whatsapp = whatsappDigits ? `https://wa.me/${whatsappDigits.startsWith('56') ? whatsappDigits : whatsappDigits.length === 9 ? `56${whatsappDigits}` : whatsappDigits}` : '';
  const socials = [
    { label: 'WhatsApp', url: whatsapp, Icon: FaWhatsapp },
    { label: 'Facebook', url: websiteSocialUrl(content.facebook, 'facebook'), Icon: FaFacebookF },
    { label: 'Instagram', url: websiteSocialUrl(content.instagram, 'instagram'), Icon: FaInstagram },
  ].filter((item) => item.url);

  const sections = {
    about: <section id="nosotros" className="site-section site-about" key="about">
      <div className="site-section-copy"><span className="site-kicker">UN BARRIO, MUCHAS HISTORIAS</span><h2>{content.aboutTitle}</h2><p>{content.about}</p><a className="site-text-link" href="#contacto">Conoce y participa <FiArrowUpRight aria-hidden="true" /></a></div>
      <div className="site-about-visual">{gallery[0] ? <img src={gallery[0]} alt={`Encuentro de ${name}`} loading="lazy" /> : <><NeighborhoodArt /><span className="site-visual-caption"><FiHeart aria-hidden="true" /> Un lugar para encontrarnos</span></>}</div>
    </section>,
    services: content.services.length > 0 && <section id="servicios" className="site-section site-services" key="services">
      <div className="site-section-heading"><div><span className="site-kicker">HACEMOS BARRIO</span><h2>{content.servicesTitle}</h2></div><a className="site-text-link" href="#contacto">Súmate a nuestra comunidad <FiArrowUpRight aria-hidden="true" /></a></div>
      <div className="site-service-grid">{content.services.map((service, index) => <article key={index}><span className="site-service-number">{String(index + 1).padStart(2, '0')}</span><h3>{service}</h3><a href="#contacto" aria-label={`Participar en ${service}`}>Quiero participar <FiArrowUpRight aria-hidden="true" /></a></article>)}</div>
    </section>,
    gallery: <GalleryCarousel images={gallery} name={name} key="gallery" />,
    news: <section className="site-section site-news" id="noticias" key="news">
      <div className="site-section-heading"><div><span className="site-kicker">LO QUE PASA AQUÍ</span><h2>{content.newsTitle}</h2><p>{content.news}</p></div><span className="site-section-symbol" aria-hidden="true">↗</span></div>
      {news.length ? <div className="site-news-grid">{news.map((item, index) => <article key={item.id} className="site-news-card">
        <div className="site-news-visual">{websiteImageUrl(item.image) ? <img src={websiteImageUrl(item.image)} alt={item.title} loading="lazy" /> : <div className="news-image-placeholder" aria-hidden="true"><FiUsers /><span>{item.category || 'Comunidad'}</span></div>}{template === 'agenda' && <time className="site-date-badge" dateTime={item.date}>{newsDate(item.date, true)}</time>}</div>
        <div className="site-news-body"><div className="site-news-meta"><span>{item.category || 'Comunidad'}</span><time dateTime={item.date}>{newsDate(item.date, true)}</time></div><h3>{item.title}</h3><p>{item.summary}</p><span className="site-news-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span></div>
      </article>)}</div> : <div className="site-news-empty"><FiCalendar aria-hidden="true" /><div><h3>Las novedades empiezan aquí</h3><p>Pronto compartiremos noticias y actividades de nuestra comunidad.</p></div></div>}
    </section>,
    contact: <section id="contacto" className="site-section site-contact" key="contact">
      <div><span className="site-kicker">LAS PUERTAS ESTÁN ABIERTAS</span><h2>{content.contactTitle}</h2><p>{content.contact}</p><div className="site-social-links">{socials.map(({ label, url, Icon }) => <a href={url} target="_blank" rel="noopener noreferrer" key={label}><Icon aria-hidden="true" /> {label}<FiArrowUpRight aria-hidden="true" /></a>)}</div></div>
      {content.address && <address><FiMapPin aria-hidden="true" /><div><small>ENCUÉNTRANOS</small><p>{content.address}</p><span>Nuestra sede vecinal</span></div></address>}
    </section>,
  };
  const order: (keyof typeof sections)[] = template === 'fotografica' ? ['gallery', 'about', 'news', 'services', 'contact'] : ['editorial', 'noticias', 'agenda', 'portal'].includes(template) ? ['news', 'about', 'services', 'gallery', 'contact'] : ['about', 'services', 'news', 'gallery', 'contact'];

  return <div className={`community-site template-${template} ${hero ? 'has-hero-image' : 'no-hero-image'}`} data-template={template} style={style}>
    <a className="site-skip-link" href="#contenido">Ir al contenido</a>
    <header className="site-header" id="inicio">
      <a className="site-brand" href="#inicio" aria-label={`Inicio de ${name}`}>{logo ? <img src={logo} alt={`Logo de ${name}`} /> : <span className="site-monogram">{monogram}</span>}<span><small>JUNTA DE VECINOS</small><strong>{name}</strong></span></a>
      <nav className="site-desktop-nav" aria-label="Navegación principal">{navigation.map(([href, label]) => <a href={href} key={href}>{label}</a>)}</nav>
      <MobileSiteMenu items={navigation} />
    </header>
    <section className="site-hero" aria-labelledby="site-title">
      <div className="site-hero-copy"><span className="site-kicker"><i aria-hidden="true" /> SOMOS COMUNIDAD</span><h1 id="site-title">{content.title}</h1><p>{content.subtitle}</p><div className="site-hero-actions"><a className="site-primary-action" href="#contacto">Participa con nosotros <FiArrowUpRight aria-hidden="true" /></a><a className="site-secondary-action" href="#nosotros">Conoce tu junta <FiArrowDown aria-hidden="true" /></a></div><div className="site-hero-signoff"><span className="site-small-monogram">{monogram}</span><span>Un espacio de todos.<br /><strong>Un barrio que construimos juntos.</strong></span></div></div>
      <div className="site-hero-visual">{hero ? <img src={hero} alt={`Nuestra comunidad, ${name}`} fetchPriority="high" /> : <NeighborhoodArt />}<span className="site-photo-note"><FiMapPin aria-hidden="true" /> {content.address || name}</span></div>
      {isInformation && <aside className="site-hero-bulletin"><span className="site-kicker">{latest ? 'ÚLTIMA PUBLICACIÓN' : 'TU JUNTA, MÁS CERCA'}</span>{latest ? <><time dateTime={latest.date}>{newsDate(latest.date)}</time><h2>{latest.title}</h2><p>{latest.summary}</p><a className="site-text-link" href="#noticias">Ver noticias <FiArrowUpRight aria-hidden="true" /></a></> : <><FiUsers className="site-bulletin-icon" aria-hidden="true" /><h2>Información para encontrarnos.</h2><p>Conoce nuestras iniciativas y los canales para participar.</p><a className="site-text-link" href="#contacto">Contacta a tu junta <FiArrowUpRight aria-hidden="true" /></a></>}</aside>}
    </section>
    <div className="site-quick-strip" aria-label="Accesos destacados">{[{ href: '#noticias', title: 'La vida del barrio', text: 'Noticias y novedades', Icon: FiCalendar }, ...(content.services.length ? [{ href: '#servicios', title: 'Juntos hacemos más', text: 'Iniciativas de la comunidad', Icon: FiUsers }] : []), { href: '#contacto', title: 'Tu voz cuenta', text: 'Conversemos y participemos', Icon: FiHeart }].map(({ href, title, text, Icon }) => <a href={href} key={href}><Icon aria-hidden="true" /><span><strong>{title}</strong><small>{text}</small></span><FiArrowUpRight aria-hidden="true" /></a>)}</div>
    <main className="site-main" id="contenido">{order.map((key) => sections[key])}</main>
    <footer className="site-footer"><a className="site-footer-brand" href="#inicio"><span className="site-small-monogram">{monogram}</span><strong>{name}</strong></a><span>Hecho para nuestra comunidad.</span><small><a href="/" target="_blank" rel="noopener noreferrer">Creado con JuntAPP</a> · <a href="https://www.purocode.com/" target="_blank" rel="noopener noreferrer">PuroCode</a></small></footer>
  </div>;
}
