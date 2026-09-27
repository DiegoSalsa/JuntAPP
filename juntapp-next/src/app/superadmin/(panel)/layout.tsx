import type { Metadata } from 'next';
import { displayAdminName, requireSuperadmin } from '@/lib/superadmin';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};
import SuperadminShell from './superadmin-shell';
import '../superadmin.css';

export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSuperadmin();
  return (
    <SuperadminShell name={displayAdminName(user)} email={user.email ?? ''}>
      {children}
    </SuperadminShell>
  );
}
