'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const pathname = usePathname();
  useEffect(() => {
    console.error('[app] Unexpected error', { route: pathname, digest: error.digest, error });
  }, [error, pathname]);
  return (
    <main style={{ minHeight: '70vh', display: 'grid', placeItems: 'center', padding: 24, color: '#031636', background: '#f7f6f0' }}>
      <div style={{ maxWidth: 440, textAlign: 'center' }}>
        <h1>No pudimos cargar esta sección</h1>
        <p>Puede ser un problema temporal de conexión. Intenta nuevamente.</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button type="button" onClick={reset}>Reintentar</button>
          <button type="button" onClick={() => window.location.reload()}>Recargar</button>
          <a href="/login">Ir al inicio de sesión</a>
        </div>
      </div>
    </main>
  );
}
