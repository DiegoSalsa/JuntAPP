import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimit } from '@/lib/rate-limit';
import { webPushPublicKey } from '@/lib/web-push';

const subscriptionSchema = z.object({
  endpoint: z.url().refine((value) => value.startsWith('https://')),
  keys: z.object({
    p256dh: z.string().min(20).max(500),
    auth: z.string().min(8).max(250),
  }),
  deviceKey: z.string().min(20).max(100).optional(),
  platform: z.enum(['ios', 'android', 'desktop', 'unknown']).default('unknown'),
  installationStatus: z.enum(['browser', 'installed']).default('browser'),
});

async function authenticatedUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET() {
  const user = await authenticatedUser();
  if (!user) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  const publicKey = webPushPublicKey();
  return NextResponse.json({ configured: Boolean(publicKey), publicKey });
}

export async function POST(request: Request) {
  const user = await authenticatedUser();
  if (!user) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  if (!(await rateLimit(`push-subscription:${user.id}`, 10, 60_000)).allowed) {
    return NextResponse.json({ error: 'Espera un momento antes de reintentar.' }, { status: 429 });
  }
  if (!webPushPublicKey()) return NextResponse.json({ error: 'Las notificaciones todavía no están configuradas.' }, { status: 503 });
  const parsed = subscriptionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Suscripción push inválida.' }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from('push_subscriptions').upsert({
    user_id: user.id,
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.keys.p256dh,
    auth: parsed.data.keys.auth,
    user_agent: request.headers.get('user-agent'),
    device_key: parsed.data.deviceKey ?? null,
    platform: parsed.data.platform,
    failure_count: 0,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'endpoint' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (parsed.data.deviceKey) {
    const now = new Date().toISOString();
    await admin.from('app_devices').upsert({
      user_id: user.id,
      device_key: parsed.data.deviceKey,
      platform: parsed.data.platform,
      installation_status: parsed.data.installationStatus,
      notifications_enabled: true,
      user_agent: request.headers.get('user-agent'),
      last_seen_at: now,
      updated_at: now,
    }, { onConflict: 'user_id,device_key' });
  }
  return NextResponse.json({ subscribed: true });
}

export async function DELETE(request: Request) {
  const user = await authenticatedUser();
  if (!user) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  const parsed = z.object({ endpoint: z.url(), deviceKey: z.string().min(20).max(100).optional() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Suscripción push inválida.' }, { status: 400 });
  const admin = createAdminClient();
  const { error } = await admin.from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('endpoint', parsed.data.endpoint);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (parsed.data.deviceKey) {
    await admin.from('app_devices').update({ notifications_enabled: false, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('device_key', parsed.data.deviceKey);
  }
  return NextResponse.json({ subscribed: false });
}
