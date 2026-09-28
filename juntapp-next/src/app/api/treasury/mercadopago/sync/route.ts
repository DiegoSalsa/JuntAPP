import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';
import { syncMercadoPagoTreasury } from '@/lib/mercadopago-treasury';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 });
  if (!(await rateLimit(`treasury-sync:${user.id}`, 4, 60_000)).allowed) {
    return NextResponse.json({ error: 'Espera un momento antes de sincronizar nuevamente.' }, { status: 429 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('junta_id, role, board_position')
    .eq('id', user.id)
    .single();
  if (!profile || profile.role !== 'dirigente' || !['presidente', 'tesorero'].includes(profile.board_position ?? '')) {
    return NextResponse.json({ error: 'Solo Presidencia o Tesorería pueden sincronizar la cuenta.' }, { status: 403 });
  }

  try {
    const result = await syncMercadoPagoTreasury(profile.junta_id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No fue posible sincronizar Mercado Pago.' }, { status: 502 });
  }
}
