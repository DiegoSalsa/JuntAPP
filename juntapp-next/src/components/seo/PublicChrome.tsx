'use client';

/* eslint-disable @next/next/no-img-element -- el encabezado público ya usa este SVG como img */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import TrackedLink from '@/components/seo/TrackedLink';
import { seoEventForHref, SEO_EVENTS } from '@/lib/seo/events';
import { FOOTER_COLUMNS, PRIMARY_NAV } from '@/lib/seo/navigation';
import { PUROCODE_URL } from '@/lib/seo/site';

function eventFor(href: string) {
  return seoEventForHref(href);
}

export default function PublicChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="original-public-root style-swiss">
      <a href="#mainContent" className="skip-link">Saltar al contenido principal</a>
      <div className="corporate-landing style-swiss">
        <header className="landing-header">
          <div className="landing-container nav-container">
            <Link href="/" className="landing-brand" style={{ textDecoration: 'none' }}>
              <div className="landing-logo-wrapper">
                <img src="/logo.svg?v=rounded-j-20260812" alt="JuntAPP" className="landing-brand-logo" />
              </div>
              <div className="landing-brand-info">
                <span className="landing-brand-name">Junt<strong>APP</strong></span>
                <span className="landing-brand-tag">Gestión vecinal</span>
              </div>
            </Link>
            <nav className="landing-nav" aria-label="Secciones">
              {PRIMARY_NAV.map((item) => {
                const current = pathname === item.href;
                return (
                  <Link key={item.href} href={item.href} className={current ? 'landing-nav-link active' : 'landing-nav-link'} aria-current={current ? 'page' : undefined}>
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="landing-nav-actions">
              <TrackedLink href="/login" className="btn btn-ghost btn-sm" event={SEO_EVENTS.login} cta="Acceder" sourceSection="header">Acceder</TrackedLink>
              <TrackedLink href="/registro" className="btn btn-primary btn-sm btn-orange" event={SEO_EVENTS.register} cta="Registrarse" sourceSection="header">Registrarse</TrackedLink>
            </div>
            <button className={open ? 'mobile-nav-toggle open' : 'mobile-nav-toggle'} id="mobileNavToggleBtn" aria-expanded={open} aria-controls="mobileNavMenu" aria-label={open ? 'Cerrar menú' : 'Abrir menú'} onClick={() => setOpen((value) => !value)}>
              <span /><span /><span />
            </button>
          </div>
        </header>
        <div className={open ? 'mobile-nav-menu open' : 'mobile-nav-menu'} id="mobileNavMenu">
          {PRIMARY_NAV.map((item) => (
            <Link key={item.href} href={item.href} className="mobile-nav-link" onClick={() => setOpen(false)}>{item.label}</Link>
          ))}
          <TrackedLink href="/login" className="btn btn-ghost btn-block" event={SEO_EVENTS.login} cta="Acceder" sourceSection="menu-movil">Acceder</TrackedLink>
          <TrackedLink href="/registro" className="btn btn-primary btn-block btn-orange" event={SEO_EVENTS.register} cta="Registrarse" sourceSection="menu-movil">Registrarse</TrackedLink>
        </div>
        {children}
        <footer className="landing-footer">
          <div className="landing-container">
            <div className="footer-grid-mural">
              <div className="footer-col brand-col">
                <div className="landing-brand">
                  <div className="landing-logo-wrapper">
                    <img src="/logo.svg?v=rounded-j-20260812" alt="" style={{ height: 24 }} />
                  </div>
                  <strong className="footer-brand-title">JuntAPP</strong>
                </div>
                <p className="footer-brand-desc">Software chileno para administrar una junta de vecinos: socios, cuotas, tesorería, comunicaciones y consultas. Desarrollado por PuroCode.</p>
                <a href={PUROCODE_URL} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                  <div className="footer-purocode-credits"><span>Diseñado y construido por</span><strong>PuroCode</strong></div>
                </a>
                <div className="footer-rubber-stamp" aria-hidden="true"><div className="stamp-border"><div className="stamp-text">PUROCODE</div><div className="stamp-badge">CHILE</div><div className="stamp-text-sub">CONCEPCIÓN</div></div></div>
              </div>
              {FOOTER_COLUMNS.map((column) => (
                <div className="footer-col links-col" key={column.title}>
                  <p className="footer-col-title">{column.title}</p>
                  <ul className="footer-links-list">
                    {column.links.map((link) => {
                      const event = eventFor(link.href);
                      return (
                        <li key={link.href}>
                          {event ? (
                            <TrackedLink href={link.href} event={event} cta={link.label} sourceSection="footer">{link.label}</TrackedLink>
                          ) : (
                            <Link href={link.href}>{link.label}</Link>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
            <div className="footer-bottom-bar">
              <p>© 2026 JuntAPP. Desarrollado por <a href={PUROCODE_URL} target="_blank" rel="noopener noreferrer">PuroCode</a> · <Link href="/legal">Términos y privacidad</Link></p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
