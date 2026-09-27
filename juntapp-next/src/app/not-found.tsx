import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Página no encontrada',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6 text-center">
      <div>
        <p className="text-sm font-semibold text-primary-lighter">404</p>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">Página no encontrada</h1>
        <p className="mt-2 text-sm text-gray-600">La dirección que ingresaste no existe o fue movida.</p>
        <Link href="/" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-white no-underline">
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
