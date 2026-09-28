import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { juntaHasActiveAccess } from '@/lib/junta-billing';
import { expireJuntaTrialIfNeeded } from '@/lib/junta-trial';
import { rateLimit } from '@/lib/rate-limit';
import { cleanRUT } from '@/lib/utils';

const registrationValidationSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  rut: z.string().trim().min(8).max(20),
  juntaAction: z.enum(['create', 'join']),
  inviteCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{6}$/).optional(),
});

export async function POST(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  if (!(await rateLimit(`registration-validation:${forwardedFor}`, 20, 60_000)).allowed) {
    return NextResponse.json({ error: 'Demasiados intentos. Espera un momento antes de reintentar.' }, { status: 429 });
  }
  const parsed = registrationValidationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Los datos de registro son inválidos.' }, { status: 400 });

  const admin = createAdminClient();
  const rut = cleanRUT(parsed.data.rut).toUpperCase();
  const email = parsed.data.email;
  const [{ data: rutOwner }, { data: emailOwner }] = await Promise.all([
    admin.from('profiles').select('id').eq('rut', rut).maybeSingle(),
    admin.from('profiles').select('id').ilike('email', email).maybeSingle(),
  ]);
  if (rutOwner || emailOwner) {
    return NextResponse.json({ error: 'El RUT o correo ya está registrado en JuntAPP. Inicia sesión o recupera tu cuenta.' }, { status: 409 });
  }

  if (parsed.data.juntaAction === 'join') {
    if (!parsed.data.inviteCode) return NextResponse.json({ error: 'Ingresa el código de seis caracteres de tu junta.' }, { status: 400 });
    const { data: junta } = await admin
      .from('juntas')
      .select('id, name, subscription_status, billing_mode, trial_ends_at')
      .eq('invite_code', parsed.data.inviteCode)
      .maybeSingle();
    if (!junta) return NextResponse.json({ error: 'El código no corresponde a ninguna junta registrada.' }, { status: 404 });
    const currentJunta = await expireJuntaTrialIfNeeded(junta);
    if (!juntaHasActiveAccess(currentJunta)) {
      return NextResponse.json({ error: 'La junta existe, pero su suscripción no está activa.' }, { status: 409 });
    }
    return NextResponse.json({ valid: true, juntaName: currentJunta.name });
  }

  return NextResponse.json({ valid: true });
}
