import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { mercadoPagoApiHeaders, syncMercadoPagoSubscription } from '@/lib/mercadopago';
import { rateLimit } from '@/lib/rate-limit';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 });
  if (!(await rateLimit(`mercadopago-cancel:${user.id}`, 3, 60_000)).allowed) {
    return NextResponse.json({ error: 'Espera un momento antes de reintentar.' }, { status: 429 });
  }

  const { data: profile } = await supabase.from('profiles').select('role, juntas(*)').eq('id', user.id).single();
  const junta = Array.isArray(profile?.juntas) ? profile.juntas[0] : profile?.juntas;
  if (!profile || !junta) return NextResponse.json({ error: 'Junta no encontrada.' }, { status: 404 });
  if (profile.role !== 'dirigente' || junta.owner_id !== user.id) {
    return NextResponse.json({ error: 'Solo quien creó la junta puede cancelar la suscripción.' }, { status: 403 });
  }
  if (!junta.mercadopago_subscription_id) {
    return NextResponse.json({ error: 'No existe una suscripción de Mercado Pago asociada.' }, { status: 409 });
  }
  if (junta.subscription_status === 'cancelled') return NextResponse.json({ status: 'cancelled' });

  try {
    const response = await fetch(`https://api.mercadopago.com/preapproval/${junta.mercadopago_subscription_id}`, {
      method: 'PUT',
      headers: mercadoPagoApiHeaders(),
      body: JSON.stringify({ status: 'cancelled' }),
      cache: 'no-store',
    });
    const result = await response.json() as { message?: string };
    if (!response.ok) return NextResponse.json({ error: result.message ?? 'Mercado Pago no pudo cancelar la suscripción.' }, { status: 400 });
    const synced = await syncMercadoPagoSubscription(junta.mercadopago_subscription_id, user.id);
    return NextResponse.json({ status: synced.status });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No fue posible cancelar la suscripción.' }, { status: 502 });
  }
}
