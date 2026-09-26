'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[app] Root error', { route: window.location.pathname, digest: error.digest, error });
  }, [error]);

  return <html lang="es"><body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, boxSizing: 'border-box', color: '#031636', background: '#f7f6f0' }}>
      <div style={{ maxWidth: 440, textAlign: 'center' }}>
        <h1>No pudimos abrir JuntAPP</h1>
        <p>Revisa tu conexión e intenta nuevamente.</p>
        <button type="button" onClick={reset}>Reintentar</button>{' '}
        <button type="button" onClick={() => window.location.reload()}>Recargar</button>{' '}
        <a href="/login">Ir al inicio de sesión</a>
      </div>
    </main>
  </body></html>;
}
