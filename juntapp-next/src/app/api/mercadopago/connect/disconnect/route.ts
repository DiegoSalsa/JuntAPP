import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimit } from '@/lib/rate-limit';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 });
  if (!(await rateLimit(`mercadopago-disconnect:${user.id}`, 3, 60_000)).allowed) {
    return NextResponse.json({ error: 'Espera un momento antes de reintentar.' }, { status: 429 });
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, junta_id, role, board_position, juntas(owner_id)')
    .eq('id', user.id)
    .single();
  const junta = Array.isArray(profile?.juntas) ? profile.juntas[0] : profile?.juntas;
  const canDisconnect = profile?.role === 'dirigente'
    && (junta?.owner_id === user.id || profile.board_position === 'presidente');
  if (!profile || !canDisconnect) {
    return NextResponse.json({ error: 'Solo la presidencia puede desconectar Mercado Pago.' }, { status: 403 });
  }
  const { error } = await createAdminClient().from('mercadopago_junta_accounts').delete().eq('junta_id', profile.junta_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ disconnected: true });
}
