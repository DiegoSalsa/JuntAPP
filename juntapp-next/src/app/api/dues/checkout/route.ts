import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';

/**
 * The individual checkout is retained as a compatibility endpoint for old
 * clients, but new payment creation is deliberately disabled. All new dues
 * must use the batch checkout, which owns the household-period lock and the
 * provider attempt lease. Historical `juntapp-due:` payments continue through
 * the webhook reconciliation in `lib/member-dues.ts`.
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 });
  if (!(await rateLimit(`member-due-checkout:${user.id}`, 6, 60_000)).allowed) {
    return NextResponse.json({ error: 'Espera un momento antes de reintentar.' }, { status: 429 });
  }
  return NextResponse.json({
    error: 'El checkout individual quedó retirado. Usa el checkout por lotes para pagar una o más cuotas.',
    endpoint: '/api/dues/batch-checkout',
  }, { status: 410 });
}
