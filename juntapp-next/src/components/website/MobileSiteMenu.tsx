'use client';

import { useEffect, useRef } from 'react';

export default function MobileSiteMenu({ items }: { items: readonly (readonly [string, string])[] }) {
  const menuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const ownerDocument = menuRef.current?.ownerDocument;
    if (!ownerDocument) return;
    function closeOutside(event: PointerEvent) {
      const menu = menuRef.current;
      if (menu?.open && event.target && !menu.contains(event.target as Node)) menu.open = false;
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && menuRef.current?.open) {
        menuRef.current.open = false;
        menuRef.current.querySelector('summary')?.focus();
      }
    }
    ownerDocument.addEventListener('pointerdown', closeOutside);
    ownerDocument.addEventListener('keydown', closeOnEscape);
    return () => {
      ownerDocument.removeEventListener('pointerdown', closeOutside);
      ownerDocument.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  return <details className="site-mobile-menu" ref={menuRef}>
    <summary aria-label="Abrir menú de navegación"><span className="site-menu-icon" aria-hidden="true"><i /><i /><i /></span><span>Menú</span></summary>
    <nav aria-label="Navegación móvil">
      {items.map(([href, label]) => <a href={href} key={href} onClick={() => { if (menuRef.current) menuRef.current.open = false; }}>{label}</a>)}
    </nav>
  </details>;
}
