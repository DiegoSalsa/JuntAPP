import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';
import { requestSuperadminLoginCode } from '@/lib/superadmin-code';
import {
  SUPERADMIN_CHALLENGE_COOKIE,
  SUPERADMIN_CODE_RESEND_SECONDS,
  SUPERADMIN_CODE_TTL_SECONDS,
  superadminCookieOptions,
  verifySuperadminChallenge,
} from '@/lib/superadmin-session';

const schema = z.object({ email: z.email().trim().toLowerCase() });
const genericMessage = 'Si el correo está autorizado, recibirás un código de acceso.';

export async function POST(request: NextRequest) {
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? 'local';
  const limit = await rateLimit(`superadmin-code-request:${clientIp}`, 5, 15 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Demasiadas solicitudes de código. Espera 15 minutos.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((limit.resetAt - Date.now()) / 1000)) },
      },
    );
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Ingresa un correo válido.' }, { status: 400 });

  const previousChallenge = verifySuperadminChallenge(
    request.cookies.get(SUPERADMIN_CHALLENGE_COOKIE)?.value,
  );
  const now = Math.floor(Date.now() / 1000);
  if (
    previousChallenge?.email === parsed.data.email &&
    previousChallenge.issuedAt + SUPERADMIN_CODE_RESEND_SECONDS > now
  ) {
    return NextResponse.json(
      { message: genericMessage },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const delivery = await requestSuperadminLoginCode(parsed.data.email);
  const challengeToken = delivery.status === 'sent' ? delivery.challengeToken : null;

  if (delivery.status === 'not_configured' || delivery.status === 'provider_error') {
    const response = NextResponse.json(
      {
        error: delivery.status === 'not_configured'
          ? 'El servicio de correo no está configurado. Revisa RESEND_API_KEY en producción.'
          : 'Resend rechazó el envío del código. Revisa el remitente o los logs de producción.',
      },
      {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
    response.cookies.set(
      SUPERADMIN_CHALLENGE_COOKIE,
      '',
      superadminCookieOptions(0),
    );
    return response;
  }

  const response = NextResponse.json(
    { message: genericMessage },
    { headers: { 'Cache-Control': 'no-store' } },
  );
  response.cookies.set(
    SUPERADMIN_CHALLENGE_COOKIE,
    challengeToken ?? '',
    superadminCookieOptions(challengeToken ? SUPERADMIN_CODE_TTL_SECONDS : 0),
  );
  return response;
}
