'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { originalFragments } from '@/content/original-fragments';
import { seoEventForHref, trackSeoEvent } from '@/lib/seo/events';

export type OriginalPublicView = 'home' | 'caracteristicas' | 'pricing' | 'faq' | 'sobreNosotros' | 'contacto' | 'legal';

export default function OriginalPublicPage({ view, children }: { view?: OriginalPublicView; children?: React.ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const handleRootClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as Element;
    const root = rootRef.current;
    if (!root) return;
    const anchor = target.closest('a');
    const eventName = seoEventForHref(anchor?.getAttribute('href'));
    if (eventName) {
      trackSeoEvent(eventName, {
        page: pathname,
        cta: anchor?.textContent?.trim() || eventName,
        source_section: 'sitio-publico',
      });
    }

    if (target.closest('#mobileNavToggleBtn')) {
      root.querySelector('#mobileNavToggleBtn')?.classList.toggle('open');
      root.querySelector('#mobileNavMenu')?.classList.toggle('open');
      return;
    }

    const mobileLink = target.closest('.mobile-nav-link');
    if (mobileLink) {
      root.querySelector('#mobileNavToggleBtn')?.classList.remove('open');
      root.querySelector('#mobileNavMenu')?.classList.remove('open');
      return;
    }

    const question = target.closest('.faq-question');
    if (question) {
      const item = question.closest('.faq-item');
      const expanded = question.getAttribute('aria-expanded') === 'true';
      root.querySelectorAll('.faq-item').forEach((other) => {
        if (other !== item) other.classList.remove('active');
        other.querySelector('.faq-question')?.setAttribute('aria-expanded', 'false');
      });
      item?.classList.toggle('active', !expanded);
      question.setAttribute('aria-expanded', String(!expanded));
    }
  };
  const publicContent = view === 'pricing'
    ? originalFragments[view]
      .replace('>14.990<', '>14.990<')
      .replace('Prueba 30 Días Gratis', 'Crear Junta · $15.000 / mes')
    : view ? originalFragments[view].replace('class="corporate-view"', 'class="corporate-view active"') : '';

  useEffect(() => {
    if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    const scrollToTop = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };
    scrollToTop();
    requestAnimationFrame(scrollToTop);
    const timer = setTimeout(scrollToTop, 50);
    document.body.classList.add('logged-out', 'style-swiss');
    document.body.classList.remove('logged-in', 'role-vecino', 'role-dirigente');
    const root = rootRef.current;
    if (!root) return;
    root.dataset.publicReady = 'true';

    const cleanups: Array<() => void> = [];
    const listen = (element: Element | null, event: string, handler: EventListener) => {
      element?.addEventListener(event, handler);
      if (element) cleanups.push(() => element.removeEventListener(event, handler));
    };

    root.querySelectorAll<HTMLAnchorElement>('.landing-nav-link, .mobile-nav-link').forEach((link) => {
      const current = link.getAttribute('href') === pathname;
      link.classList.toggle('active', current);
      if (current) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    root.querySelectorAll('.btn-open-auth').forEach((button) => {
      listen(button, 'click', () => router.push(button.getAttribute('data-tab') === 'register' ? '/registro' : '/login'));
    });

    root.querySelectorAll('.faq-category-btn').forEach((button) => {
      listen(button, 'click', () => {
        root.querySelectorAll('.faq-category-btn').forEach((item) => item.classList.remove('active'));
        button.classList.add('active');
        const category = button.getAttribute('data-category');
        root.querySelectorAll('.faq-item').forEach((item) => {
          item.classList.toggle('hidden-faq', category !== 'all' && item.getAttribute('data-category') !== category);
          item.classList.remove('active');
        });
      });
    });

    const contactForm = root.querySelector<HTMLFormElement>('#landingContactForm');
    listen(contactForm, 'submit', ((event: SubmitEvent) => {
      event.preventDefault();
      const field = (id: string) => root.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#${id}`)?.value.trim() ?? '';
      const name = field('contactName');
      const junta = field('contactComuna');
      const email = field('contactEmail');
      const message = field('contactMessage');
      trackSeoEvent('seo_contact_click', { page: pathname, cta: 'formulario-contacto', source_section: 'contacto' });
      const body = `Nombre: ${name}\nJunta o comuna: ${junta}\nCorreo: ${email}\n\n${message}`;
      window.location.href = `mailto:contacto@juntapp.cl?subject=${encodeURIComponent('Consulta desde juntapp.cl')}&body=${encodeURIComponent(body)}`;
    }) as EventListener);

    const search = root.querySelector<HTMLInputElement>('#bento-socios-search');
    listen(search, 'input', () => {
      const query = search?.value.toLowerCase().trim() ?? '';
      root.querySelectorAll<HTMLElement>('#bento-socios-list .widget-socio-item-mural').forEach((item) => {
        item.style.display = (item.getAttribute('data-name') ?? '').includes(query) ? 'flex' : 'none';
      });
    });

    const poll = root.querySelector('#bento-poll');
    listen(poll, 'click', ((event: MouseEvent) => {
      const button = (event.target as Element).closest('.poll-option-btn-mural');
      if (!button || poll?.classList.contains('voted')) return;
      poll?.classList.add('voted');
      button.classList.add('selected');
      const first = button.getAttribute('data-option') === '1';
      const values = first ? ['79%', '21%'] : ['77%', '23%'];
      const ids = ['bento-poll-opt1', 'bento-poll-opt2'];
      ids.forEach((id, index) => {
        const percentage = root.querySelector<HTMLElement>(`#${id}-pct`);
        const fill = root.querySelector<HTMLElement>(`#${id}-fill`);
        if (percentage) percentage.textContent = values[index];
        if (fill) fill.style.width = values[index];
      });
      const status = root.querySelector<HTMLElement>('#bento-poll-status');
      if (status) status.textContent = '¡Respuesta registrada con éxito! Gracias por participar.';
    }) as EventListener);

    const billing = root.querySelector('#billingToggleBtn');
    listen(billing, 'click', () => {
      const annual = billing?.classList.toggle('active') ?? false;
      root.querySelector('#billing-monthly-label')?.classList.toggle('active', !annual);
      root.querySelector('#billing-annual-label')?.classList.toggle('active', annual);
      const prices = annual ? ['0', '14.990', '22.990'] : ['0', '14.990', '29.990'];
      ['pilot', 'activa', 'grande'].forEach((plan, index) => {
        const price = root.querySelector(`#price-${plan}`);
        const period = root.querySelector(`#period-${plan}`);
        if (price) price.textContent = prices[index];
        if (period) period.textContent = annual ? ' / año' : ' / mes';
      });
    });

    const noteList = root.querySelector('.note-handwritten-list');
    const handwritten = root.querySelector('.cork-handwritten-note');
    const stamp = document.createElement('div');
    stamp.className = 'tasks-completed-stamp';
    stamp.textContent = '¡SEDE AL DÍA! 🌳';
    handwritten?.appendChild(stamp);
    listen(noteList, 'click', ((event: MouseEvent) => {
      const item = (event.target as Element).closest('li');
      item?.classList.toggle('checked');
      const all = noteList?.querySelectorAll('li').length ?? 0;
      stamp.classList.toggle('active', all > 0 && noteList?.querySelectorAll('li.checked').length === all);
    }) as EventListener);

    const calendar = root.querySelector('.sim-calendar-grid');
    const eventCallout = root.querySelector<HTMLElement>('.calendar-event-callout');
    listen(calendar, 'click', ((event: MouseEvent) => {
      const day = event.target as HTMLElement;
      const value = day.textContent?.trim() ?? '';
      if (day.classList.contains('cal-day-header') || !/^\d+$/.test(value)) return;
      day.classList.toggle('circled');
      if (!eventCallout) return;
      if (!day.classList.contains('circled')) { eventCallout.classList.remove('active'); return; }
      const events: Record<string, [string, string]> = { '4': ['⚠ Corte de Agua', 'Corte programado de 14:00 a 18:00 hrs.'], '6': ['📢 Asamblea', 'Reunión a las 18:00 hrs en la Sede Comunitaria.'], '24': ['🎉 Día del Vecino', 'Actividad familiar en la plaza central desde las 15:00 hrs.'] };
      const [title, description] = events[value] ?? [`📌 Día ${value}`, 'Día marcado en el calendario comunitario.'];
      eventCallout.replaceChildren(Object.assign(document.createElement('strong'), { textContent: title }), document.createElement('br'), Object.assign(document.createElement('span'), { textContent: description }));
      eventCallout.classList.add('active');
    }) as EventListener);

    root.querySelectorAll('.cork-pin-note-v3, .cork-polaroid-photo-v3').forEach((note) => {
      const pin = note.querySelector<HTMLElement>('.pin-marker');
      listen(pin, 'click', ((event: MouseEvent) => { event.stopPropagation(); if (pin) pin.style.display = 'none'; note.classList.add('fallen-note'); }) as EventListener);
    });
    if (handwritten) {
      const leftTape = handwritten.querySelector<HTMLElement>('.tape-top-left');
      const rightTape = handwritten.querySelector<HTMLElement>('.tape-top-right');
      let leftRemoved = false;
      let rightRemoved = false;
      const updateTape = () => {
        handwritten.classList.toggle('dangling-right', leftRemoved && !rightRemoved);
        handwritten.classList.toggle('dangling-left', rightRemoved && !leftRemoved);
        handwritten.classList.toggle('fallen-note', leftRemoved && rightRemoved);
      };
      listen(leftTape, 'click', ((event: MouseEvent) => { event.stopPropagation(); leftRemoved = true; if (leftTape) leftTape.style.display = 'none'; updateTape(); }) as EventListener);
      listen(rightTape, 'click', ((event: MouseEvent) => { event.stopPropagation(); rightRemoved = true; if (rightTape) rightTape.style.display = 'none'; updateTape(); }) as EventListener);
    }

    const corkboard = root.querySelector('.hero-corkboard-container-v3');
    if (corkboard) {
      const restore = document.createElement('button'); restore.className = 'restore-mural-btn'; restore.textContent = '↻'; restore.title = 'Reiniciar Mural';
      corkboard.appendChild(restore);
      listen(restore, 'click', () => window.location.reload());
    }

    const sociosList = root.querySelector('#bento-socios-list');
    listen(sociosList, 'click', ((event: MouseEvent) => {
      const badge = (event.target as Element).closest('.socio-status-badge');
      if (!badge) return;
      const active = badge.classList.toggle('status-active');
      badge.classList.toggle('status-pending', !active);
      badge.textContent = active ? 'Al día' : 'Pendiente';
    }) as EventListener);

    const alerts = [
      ['📢', 'Campaña de Vacunación', 'Este jueves desde las 9:00 hrs en el consultorio central.'],
      ['⚠', 'Simulacro de Sismo', 'Viernes a las 20:00 hrs. Identifica tu zona segura.'],
      ['🎉', 'Feria de Emprendedores', 'Sábado de 10:00 a 18:00 en la plaza.'],
    ];
    let alertIndex = 0;
    const notificationContainer = root.querySelector('#bento-phone-notifications');
    listen(root.querySelector('#btn-trigger-bento-alert'), 'click', () => {
      if (!notificationContainer) return;
      const [icon, title, message] = alerts[alertIndex++ % alerts.length];
      const card = document.createElement('div'); card.className = 'phone-notification-card';
      const iconElement = document.createElement('div'); iconElement.className = 'noti-icon'; iconElement.textContent = icon;
      const content = document.createElement('div'); content.className = 'noti-content';
      const titleElement = document.createElement('span'); titleElement.className = 'noti-title'; titleElement.textContent = title;
      const body = document.createElement('span'); body.className = 'noti-body'; body.textContent = message;
      content.append(titleElement, body); card.append(iconElement, content); notificationContainer.prepend(card);
      const cards = notificationContainer.querySelectorAll('.phone-notification-card'); if (cards.length > 2) cards[cards.length - 1].remove();
    });

    return () => {
      clearTimeout(timer);
      cleanups.forEach((cleanup) => cleanup());
      delete root.dataset.publicReady;
      document.body.classList.remove('logged-out');
    };
  }, [pathname, router, view]);

  return (
    <div ref={rootRef} className="original-public-root style-swiss" onClick={handleRootClick}>
      <a href="#mainContent" className="skip-link">Saltar al contenido principal</a>
      <div className="corporate-landing style-swiss">
        <div dangerouslySetInnerHTML={{ __html: originalFragments.header.replaceAll('j-monogram-20260717', 'rounded-j-20260812') }} />
        <div dangerouslySetInnerHTML={{ __html: originalFragments.mobileNav }} />
        <div id="mainContent" className="corporate-views-wrapper">
          {view ? <div dangerouslySetInnerHTML={{ __html: publicContent }} /> : null}
          {children}
        </div>
        <div dangerouslySetInnerHTML={{ __html: originalFragments.footer.replaceAll('j-monogram-20260717', 'rounded-j-20260812') }} />
      </div>
    </div>
  );
}
