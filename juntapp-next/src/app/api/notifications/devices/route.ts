import { NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const deviceSchema = z.object({
  deviceKey: z.string().min(20).max(100),
  platform: z.enum(['ios', 'android', 'desktop', 'unknown']),
  installationStatus: z.enum(['browser', 'installed']),
  notificationsEnabled: z.boolean(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  if (!(await rateLimit(`app-device:${user.id}`, 20, 60_000)).allowed) {
    return NextResponse.json({ error: 'Espera un momento antes de actualizar este dispositivo.' }, { status: 429 });
  }
  const parsed = deviceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Estado de dispositivo inválido.' }, { status: 400 });
  const now = new Date().toISOString();
  const { error } = await createAdminClient().from('app_devices').upsert({
    user_id: user.id,
    device_key: parsed.data.deviceKey,
    platform: parsed.data.platform,
    installation_status: parsed.data.installationStatus,
    notifications_enabled: parsed.data.notificationsEnabled,
    user_agent: request.headers.get('user-agent'),
    last_seen_at: now,
    updated_at: now,
  }, { onConflict: 'user_id,device_key' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ saved: true });
}
