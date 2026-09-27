import type { Metadata, Viewport } from 'next';
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar';
import { DEFAULT_DESCRIPTION, SITE_URL } from '@/lib/seo/site';
import './globals.css';
import '@/styles/original/style.css';
import '@/styles/original/seo-growth.css';
import 'driver.js/dist/driver.css';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'JuntAPP | Gestión digital para juntas de vecinos en Chile',
  description: DEFAULT_DESCRIPTION,
  applicationName: 'JuntAPP',
  manifest: '/manifest.webmanifest?v=rounded-j-20260812',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'JuntAPP',
  },
  icons: {
    icon: [
      { url: '/brand/favicon.svg?v=rounded-j-20260812', type: 'image/svg+xml' },
      { url: '/icons/favicon-32x32.png?v=rounded-j-20260812', sizes: '32x32', type: 'image/png' },
      { url: '/icons/favicon-16x16.png?v=rounded-j-20260812', sizes: '16x16', type: 'image/png' },
    ],
    shortcut: '/favicon.ico?v=rounded-j-20260812',
    apple: [
      { url: '/icons/apple/apple-touch-icon-180.png?v=rounded-j-20260812', sizes: '180x180', type: 'image/png' },
      { url: '/icons/apple/apple-touch-icon-167.png?v=rounded-j-20260812', sizes: '167x167', type: 'image/png' },
      { url: '/icons/apple/apple-touch-icon-152.png?v=rounded-j-20260812', sizes: '152x152', type: 'image/png' },
      { url: '/icons/apple/apple-touch-icon-120.png?v=rounded-j-20260812', sizes: '120x120', type: 'image/png' },
    ],
    other: [{ rel: 'mask-icon', url: '/brand/safari-pinned-tab.svg?v=rounded-j-20260812', color: '#031636' }],
  },
  other: {
    'msapplication-config': '/browserconfig.xml',
    'msapplication-TileColor': '#031636',
  },
};

export const viewport: Viewport = {
  themeColor: '#031636',
  colorScheme: 'light dark',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="style-swiss">
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
