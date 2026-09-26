import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import OriginalDashboardShell from '@/components/original/OriginalDashboardShell';
import { juntaHasActiveAccess } from '@/lib/junta-billing';
import { expireJuntaTrialIfNeeded } from '@/lib/junta-trial';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) {
    if (authError.name === 'AuthSessionMissingError' || authError.status === 401 || authError.status === 403 || authError.code === 'refresh_token_not_found') redirect('/login');
    console.error('[dashboard] Authentication unavailable', { route: 'dashboard', code: authError.code });
    throw new Error('No fue posible verificar la sesión.');
  }
  if (!user) redirect('/login');

  const { data: profile, error: profileError } = await supabase.from('profiles').select('*, juntas(*)').eq('id', user.id).single();
  if (profileError) {
    console.error('[dashboard] Profile unavailable', { route: 'dashboard', code: profileError.code });
    throw new Error('No fue posible cargar el perfil.');
  }
  if (!profile) redirect('/login');
  const rawJunta = Array.isArray(profile.juntas) ? profile.juntas[0] : profile.juntas;
  if (!rawJunta) redirect('/registro/pago');
  const junta = await expireJuntaTrialIfNeeded(rawJunta);
  if (!juntaHasActiveAccess(junta)) redirect('/registro/pago');
  const trialEndsAt = junta.billing_mode === 'trial_then_subscription' ? junta.trial_ends_at : null;

  return (
    <>
      <OriginalDashboardShell profile={profile} junta={junta} trialEndsAt={trialEndsAt}>{children}</OriginalDashboardShell>
    </>
  );
}
