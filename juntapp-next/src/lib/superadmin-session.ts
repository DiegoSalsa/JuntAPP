import 'server-only';

import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { getSuperadminAccount } from '@/lib/superadmin-config';

export const SUPERADMIN_SESSION_COOKIE = 'juntapp_superadmin_session';
export const SUPERADMIN_CHALLENGE_COOKIE = 'juntapp_superadmin_challenge';
export const SUPERADMIN_CODE_TTL_SECONDS = 10 * 60;
export const SUPERADMIN_SESSION_TTL_SECONDS = 8 * 60 * 60;
export const SUPERADMIN_CODE_MAX_ATTEMPTS = 5;
export const SUPERADMIN_CODE_RESEND_SECONDS = 60;

export type SuperadminSession = {
  id: string;
  email: string;
  name: string;
};

type SessionPayload = SuperadminSession & {
  kind: 'session';
  version: 1;
  expiresAt: number;
};

export type SuperadminChallenge = {
  kind: 'challenge';
  version: 1;
  email: string;
  codeHash: string;
  attempts: number;
  issuedAt: number;
  expiresAt: number;
};

function authSecret(purpose: 'session' | 'code') {
  const configured = purpose === 'code' ? process.env.SUPERADMIN_CODE_SECRET : process.env.SUPERADMIN_SESSION_SECRET;
  if (configured && configured.length >= 32) return configured;
  throw new Error(`Falta SUPERADMIN_${purpose === 'code' ? 'CODE' : 'SESSION'}_SECRET con al menos 32 caracteres.`);
}

function sign(encodedPayload: string, purpose: 'session' | 'code') {
  return createHmac('sha256', authSecret(purpose))
    .update(`${purpose}:${encodedPayload}`)
    .digest('base64url');
}

function encodeToken(payload: object, purpose: 'session' | 'code') {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encodedPayload}.${sign(encodedPayload, purpose)}`;
}

function decodeToken(token: string, purpose: 'session' | 'code'): unknown {
  const [encodedPayload, providedSignature, extra] = token.split('.');
  if (!encodedPayload || !providedSignature || extra) return null;

  const expectedSignature = sign(encodedPayload, purpose);
  const provided = Buffer.from(providedSignature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;

  try {
    return JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function hashLoginCode(email: string, code: string) {
  return createHmac('sha256', authSecret('code'))
    .update(`superadmin-code:${email}:${code}`)
    .digest('hex');
}

export function createSixDigitSuperadminCode() {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export function createSuperadminChallenge(email: string, code: string) {
  const now = Math.floor(Date.now() / 1000);
  const payload: SuperadminChallenge = {
    kind: 'challenge',
    version: 1,
    email,
    codeHash: hashLoginCode(email, code),
    attempts: 0,
    issuedAt: now,
    expiresAt: now + SUPERADMIN_CODE_TTL_SECONDS,
  };
  return encodeToken(payload, 'code');
}

export function verifySuperadminChallenge(token: string | undefined): SuperadminChallenge | null {
  if (!token) return null;
  const payload = decodeToken(token, 'code') as Partial<SuperadminChallenge> | null;
  if (
    !payload ||
    payload.kind !== 'challenge' ||
    payload.version !== 1 ||
    typeof payload.email !== 'string' ||
    typeof payload.codeHash !== 'string' ||
    typeof payload.attempts !== 'number' ||
    typeof payload.issuedAt !== 'number' ||
    typeof payload.expiresAt !== 'number' ||
    payload.expiresAt <= Math.floor(Date.now() / 1000) ||
    payload.attempts >= SUPERADMIN_CODE_MAX_ATTEMPTS ||
    !getSuperadminAccount(payload.email)
  ) {
    return null;
  }
  return payload as SuperadminChallenge;
}

export function challengeCodeMatches(challenge: SuperadminChallenge, code: string) {
  const expected = Buffer.from(challenge.codeHash, 'hex');
  const actual = Buffer.from(hashLoginCode(challenge.email, code), 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function incrementChallengeAttempts(challenge: SuperadminChallenge) {
  return encodeToken({ ...challenge, attempts: challenge.attempts + 1 }, 'code');
}

export function createSuperadminSessionToken(email: string) {
  const account = getSuperadminAccount(email);
  if (!account) return null;
  const payload: SessionPayload = {
    kind: 'session',
    version: 1,
    id: `superadmin:${account.email}`,
    email: account.email,
    name: account.name,
    expiresAt: Math.floor(Date.now() / 1000) + SUPERADMIN_SESSION_TTL_SECONDS,
  };
  return encodeToken(payload, 'session');
}

export function verifySuperadminSessionToken(token: string | undefined): SuperadminSession | null {
  if (!token) return null;
  const payload = decodeToken(token, 'session') as Partial<SessionPayload> | null;
  if (
    !payload ||
    payload.kind !== 'session' ||
    payload.version !== 1 ||
    typeof payload.id !== 'string' ||
    typeof payload.email !== 'string' ||
    typeof payload.name !== 'string' ||
    typeof payload.expiresAt !== 'number' ||
    payload.expiresAt <= Math.floor(Date.now() / 1000) ||
    !getSuperadminAccount(payload.email)
  ) {
    return null;
  }
  return { id: payload.id, email: payload.email, name: payload.name };
}

export async function getSuperadminSession() {
  const cookieStore = await cookies();
  return verifySuperadminSessionToken(cookieStore.get(SUPERADMIN_SESSION_COOKIE)?.value);
}

export function superadminCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  };
}
