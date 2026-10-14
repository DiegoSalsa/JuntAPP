'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import WebsiteRenderer, { type WebsiteRendererProps } from './WebsiteRenderer';

const documentSource = '<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Vista previa de tu sitio</title><style>html,body{margin:0;min-height:100%;background:#fff}html{scroll-behavior:smooth}body{overflow-x:clip}</style></head><body class="style-swiss"></body></html>';

/** A separate viewport makes responsive styles match the published website. */
export default function WebsitePreview({ width, onEscape, ...props }: WebsiteRendererProps & { width: number; onEscape?: () => void }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  // The srcDoc can finish loading before React hydrates a server-rendered iframe.
  const registerFrame = useCallback((frame: HTMLIFrameElement | null) => {
    frameRef.current = frame;
    if (frame?.contentDocument?.readyState === 'complete') setTarget(frame.contentDocument.body);
  }, []);

  useEffect(() => {
    if (!target) return;
    const head = target.ownerDocument.head;
    function syncStyles() {
      head.querySelectorAll('[data-preview-style]').forEach((node) => node.remove());
      document.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
        const copy = node.cloneNode(true) as HTMLElement;
        copy.setAttribute('data-preview-style', '');
        head.appendChild(copy);
      });
    }
    syncStyles();
    const observer = new MutationObserver(syncStyles);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [target]);

  useEffect(() => {
    if (!target || !onEscape) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onEscape(); };
    const ownerDocument = target.ownerDocument;
    ownerDocument.addEventListener('keydown', close);
    return () => ownerDocument.removeEventListener('keydown', close);
  }, [target, onEscape]);

  return <iframe ref={registerFrame} className="website-preview-frame" title="Vista previa del sitio web" srcDoc={documentSource} style={{ width }} onLoad={() => setTarget(frameRef.current?.contentDocument?.body ?? null)}>
    {target && createPortal(<WebsiteRenderer {...props} />, target)}
  </iframe>;
}
