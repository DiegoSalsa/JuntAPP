import { NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { retryPushNotificationJob } from '@/lib/web-push';

async function currentProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from('profiles').select('id, junta_id, role').eq('id', user.id).single();
  return profile;
}

export async function GET() {
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  const admin = createAdminClient();
  const [{ data: personalDevices }, { data: personalSubscriptions }] = await Promise.all([
    admin.from('app_devices').select('installation_status, notifications_enabled').eq('user_id', profile.id),
    admin.from('push_subscriptions').select('id, last_success_at, failure_count').eq('user_id', profile.id),
  ]);
  const response: Record<string, unknown> = {
    personal: {
      devices: personalDevices?.length ?? 0,
      installed: Boolean(personalDevices?.some((device) => device.installation_status === 'installed')),
      subscriptions: personalSubscriptions?.length ?? 0,
      notificationsEnabled: Boolean(personalSubscriptions?.length),
    },
  };
  if (profile.role !== 'dirigente') return NextResponse.json(response);

  const { data: members } = await admin.from('profiles').select('id').eq('junta_id', profile.junta_id);
  const memberIds = (members ?? []).map((member) => member.id);
  const [devicesResult, subscriptionsResult, jobsResult] = await Promise.all([
    memberIds.length ? admin.from('app_devices').select('user_id, installation_status, notifications_enabled').in('user_id', memberIds) : Promise.resolve({ data: [] }),
    memberIds.length ? admin.from('push_subscriptions').select('user_id, last_success_at, failure_count').in('user_id', memberIds) : Promise.resolve({ data: [] }),
    admin.from('push_notification_jobs')
      .select('id, title, status, recipient_count, subscription_count, delivered_count, failed_count, attempts, last_error, created_at')
      .eq('junta_id', profile.junta_id)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);
  const devices = devicesResult.data ?? [];
  const subscriptions = subscriptionsResult.data ?? [];
  response.organization = {
    members: memberIds.length,
    installedUsers: new Set(devices.filter((device) => device.installation_status === 'installed').map((device) => device.user_id)).size,
    subscribedUsers: new Set(subscriptions.map((subscription) => subscription.user_id)).size,
    devices: devices.length,
    subscriptions: subscriptions.length,
    healthySubscriptions: subscriptions.filter((subscription) => Number(subscription.failure_count) === 0).length,
  };
  response.jobs = jobsResult.data ?? [];
  return NextResponse.json(response);
}

export async function POST(request: Request) {
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  if (profile.role !== 'dirigente') return NextResponse.json({ error: 'Solo la directiva puede reintentar envíos.' }, { status: 403 });
  if (!(await rateLimit(`push-retry:${profile.id}`, 10, 60_000)).allowed) {
    return NextResponse.json({ error: 'Espera un momento antes de reintentar.' }, { status: 429 });
  }
  const parsed = z.object({ jobId: z.uuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Envío inválido.' }, { status: 400 });
  try {
    const job = await retryPushNotificationJob(parsed.data.jobId, profile.junta_id);
    return NextResponse.json({ job });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No fue posible reintentar.' }, { status: 400 });
  }
}
