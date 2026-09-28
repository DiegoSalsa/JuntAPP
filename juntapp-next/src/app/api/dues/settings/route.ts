import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';

const settingsSchema = z.object({ amount: z.number().int().min(500).max(1_000_000) });

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 });
  if (!(await rateLimit(`dues-settings:${user.id}`, 10, 60_000)).allowed) {
    return NextResponse.json({ error: 'Espera un momento antes de reintentar.' }, { status: 429 });
  }
  const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Ingresa un monto entre $500 y $1.000.000.' }, { status: 400 });
  const { data: profile } = await supabase.from('profiles').select('junta_id, role, board_position').eq('id', user.id).single();
  if (!profile || profile.role !== 'dirigente' || !['presidente', 'tesorero'].includes(profile.board_position ?? '')) {
    return NextResponse.json({ error: 'Solo Presidencia o Tesorería pueden cambiar el monto de la cuota.' }, { status: 403 });
  }
  const { error } = await supabase.from('juntas').update({ monthly_due_amount: parsed.data.amount }).eq('id', profile.junta_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ amount: parsed.data.amount });
}
