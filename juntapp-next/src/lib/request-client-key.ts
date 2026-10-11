/**
 * Returns the platform-normalized client address used for abuse controls.
 * Do not trust the user-controlled X-Forwarded-For chain directly.
 */
export function requestClientKey(request: Request): string {
  const normalized = [
    request.headers.get('x-real-ip'),
    request.headers.get('cf-connecting-ip'),
    request.headers.get('true-client-ip'),
  ].find((value) => value && value.trim());
  return normalized?.trim() ?? 'unknown-client';
}
