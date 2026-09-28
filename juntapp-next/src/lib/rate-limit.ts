import { createAdminClient } from '@/lib/supabase/admin';

/** Distributed, atomic limiter backed by Supabase/PostgreSQL. */
export async function rateLimit(key: string, limit: number, windowMs: number) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('consume_rate_limit', {
    p_key: key,
    p_limit: limit,
    p_window_seconds: Math.max(1, Math.ceil(windowMs / 1000)),
  });
  const result = Array.isArray(data) ? data[0] : data;
  if (error || !result) return { allowed: false, remaining: 0, resetAt: Date.now() + windowMs };
  return {
    allowed: Boolean(result.allowed),
    remaining: Number(result.remaining ?? 0),
    resetAt: new Date(result.reset_at).getTime(),
  };
}
