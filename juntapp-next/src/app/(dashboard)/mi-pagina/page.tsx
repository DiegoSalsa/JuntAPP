import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import WebsiteBuilder from '@/components/website/WebsiteBuilder';

export const metadata = { title: 'Mi página web — JuntAPP' };

export default async function MyWebsitePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile, error: profileError } = await supabase.from('profiles').select('role,junta_id,juntas(*)').eq('id', user.id).single();
  if (profileError) throw new Error('No fue posible cargar la junta. Intenta nuevamente.');
  const junta = Array.isArray(profile?.juntas) ? profile.juntas[0] : profile?.juntas;
  if (!junta || profile?.role !== 'dirigente') redirect('/inicio');
  if (!['web', 'juntapp_web'].includes(junta.subscription_plan ?? 'juntapp')) redirect('/pricing');
  const { data: page, error: pageError } = await supabase.from('website_pages').select('*').eq('junta_id', junta.id).maybeSingle();
  // A failed read must never initialize an empty editor over an existing website.
  if (pageError) throw new Error('No fue posible cargar tu página. Tus datos están conservados; intenta nuevamente.');
  return <WebsiteBuilder juntaId={junta.id} juntaName={junta.name} slug={junta.slug} plan={junta.subscription_plan as 'web' | 'juntapp_web'} initial={page} />;
}
