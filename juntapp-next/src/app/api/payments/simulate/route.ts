import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimit } from '@/lib/rate-limit';

const paymentSchema = z.object({ method: z.enum(['webpay', 'transfer', 'digital']) });

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!(await rateLimit(`payment-simulator:${user.id}`, 5, 60_000)).allowed) return NextResponse.json({ error: 'Espera un momento antes de reintentar.' }, { status: 429 });
  const parsed = paymentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Método de pago inválido.' }, { status: 400 });
  const { data: profile } = await supabase.from('profiles').select('id, junta_id, name, cuota_status').eq('id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Perfil no encontrado.' }, { status: 404 });
  if (profile.cuota_status === 'al_dia') return NextResponse.json({ error: 'Tu cuota ya está al día.' }, { status: 409 });

  const admin = createAdminClient();
  const methodNames = { webpay: 'Webpay Plus (simulación)', transfer: 'Transferencia (simulación)', digital: 'Pago móvil (simulación)' };
  const { data: transaction, error: transactionError } = await admin.from('transactions').insert({ junta_id: profile.junta_id, type: 'ingreso', description: `Pago Cuota Social — ${profile.name} — ${methodNames[parsed.data.method]}`, amount: 5000, date: new Date().toISOString().slice(0, 10), created_by: user.id }).select('id').single();
  if (transactionError) return NextResponse.json({ error: transactionError.message }, { status: 400 });
  const { error: profileError } = await admin.from('profiles').update({ cuota_status: 'al_dia' }).eq('id', user.id).eq('junta_id', profile.junta_id);
  if (profileError) { await admin.from('transactions').delete().eq('id', transaction.id); return NextResponse.json({ error: profileError.message }, { status: 400 }); }
  await admin.from('notifications').insert({ user_id: user.id, type: 'cuota', title: 'Pago recibido con éxito', message: 'Tu cuota social de $5.000 fue registrada correctamente.', read: false, date: new Date().toISOString(), action: '/tesoreria' });
  return NextResponse.json({ success: true, transactionId: `JV-${transaction.id}`, date: new Date().toLocaleString('es-CL'), method: methodNames[parsed.data.method] });
}
