import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';
import {
  challengeCodeMatches,
  createSuperadminSessionToken,
  incrementChallengeAttempts,
  SUPERADMIN_CHALLENGE_COOKIE,
  SUPERADMIN_CODE_MAX_ATTEMPTS,
  SUPERADMIN_SESSION_COOKIE,
  SUPERADMIN_SESSION_TTL_SECONDS,
  superadminCookieOptions,
  verifySuperadminChallenge,
} from '@/lib/superadmin-session';

const schema = z.object({
  email: z.email().trim().toLowerCase(),
  code: z.string().regex(/^\d{6}$/),
});
const invalidCodeMessage = 'Código inválido o vencido.';

export async function POST(request: NextRequest) {
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? 'local';
  const limit = await rateLimit(`superadmin-code-verify:${clientIp}`, 15, 15 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Demasiados intentos de verificación. Espera 15 minutos.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((limit.resetAt - Date.now()) / 1000)) },
      },
    );
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  const challenge = verifySuperadminChallenge(
    request.cookies.get(SUPERADMIN_CHALLENGE_COOKIE)?.value,
  );
  if (!parsed.success || !challenge || challenge.email !== parsed.data.email) {
    return NextResponse.json({ error: invalidCodeMessage }, { status: 401 });
  }

  if (!challengeCodeMatches(challenge, parsed.data.code)) {
    const nextAttempts = challenge.attempts + 1;
    const response = NextResponse.json({ error: invalidCodeMessage }, { status: 401 });
    response.cookies.set(
      SUPERADMIN_CHALLENGE_COOKIE,
      nextAttempts >= SUPERADMIN_CODE_MAX_ATTEMPTS ? '' : incrementChallengeAttempts(challenge),
      superadminCookieOptions(
        nextAttempts >= SUPERADMIN_CODE_MAX_ATTEMPTS
          ? 0
          : Math.max(1, challenge.expiresAt - Math.floor(Date.now() / 1000)),
      ),
    );
    return response;
  }

  const sessionToken = createSuperadminSessionToken(challenge.email);
  if (!sessionToken) return NextResponse.json({ error: invalidCodeMessage }, { status: 401 });

  console.info('[Superadmin] Acceso por código verificado.', {
    email: challenge.email,
    ipAddress: clientIp,
  });

  const response = NextResponse.json(
    { message: 'Acceso verificado.' },
    { headers: { 'Cache-Control': 'no-store' } },
  );
  response.cookies.set(
    SUPERADMIN_SESSION_COOKIE,
    sessionToken,
    superadminCookieOptions(SUPERADMIN_SESSION_TTL_SECONDS),
  );
  response.cookies.set(SUPERADMIN_CHALLENGE_COOKIE, '', superadminCookieOptions(0));
  return response;
}
