import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { authActionUrl, publicAppUrl, sendEmailBestEffort } from '@/lib/email';
import { passwordRecoveryTemplate } from '@/lib/email-templates';
import { rateLimit } from '@/lib/rate-limit';

const schema = z.object({ email: z.email().trim().toLowerCase() });
const genericMessage = 'Si el correo pertenece a una cuenta, recibirás un enlace para crear una nueva contraseña.';

export async function POST(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  if (!(await rateLimit(`password-recovery:${forwardedFor}`, 4, 60 * 60_000)).allowed) {
    return NextResponse.json({ message: genericMessage });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Ingresa un correo válido.' }, { status: 400 });

  const { data, error } = await createAdminClient().auth.admin.generateLink({
    type: 'recovery',
    email: parsed.data.email,
    options: { redirectTo: `${publicAppUrl()}/aceptar-invitacion` },
  });
  if (!error && data.properties?.action_link) {
    const template = passwordRecoveryTemplate({
      name: typeof data.user.user_metadata?.name === 'string' ? data.user.user_metadata.name : undefined,
      actionUrl: authActionUrl(data.properties),
    });
    await sendEmailBestEffort({
      to: parsed.data.email,
      ...template,
      idempotencyKey: `password-recovery:${data.properties.hashed_token}`,
    });
  }
  return NextResponse.json({ message: genericMessage });
}
