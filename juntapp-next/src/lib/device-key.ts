const STORAGE_KEY = 'juntapp-device-key';
let sessionKey: string | undefined;

function newKey(): string {
  try {
    if (typeof crypto !== 'undefined') {
      if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
      if (typeof crypto.getRandomValues === 'function') {
        const bytes = crypto.getRandomValues(new Uint8Array(16));
        return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
      }
    }
  } catch {
    // Restricted browser contexts may expose crypto but reject individual operations.
  }
  // This is only a device tracking key, never an authentication or security token.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

export function deviceKey(): string {
  if (sessionKey) return sessionKey;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) return (sessionKey = stored);
  } catch {
    // Keep a stable key for this page session when storage is blocked.
  }
  sessionKey = newKey();
  try {
    window.localStorage.setItem(STORAGE_KEY, sessionKey);
  } catch {
    // Push registration remains optional when storage cannot persist the key.
  }
  return sessionKey;
}
