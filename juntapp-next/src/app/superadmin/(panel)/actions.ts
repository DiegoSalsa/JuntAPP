'use server';

import { randomBytes, randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { addCalendarMonths } from '@/lib/junta-billing';
import { isValidChileLocation } from '@/lib/chile-locations';
import { authActionUrl, publicAppUrl, sendTransactionalEmail } from '@/lib/email';
import { juntaOwnerInviteTemplate } from '@/lib/email-templates';
import { subscriptionPrice } from '@/lib/plans';
import { isSuperadminEmail } from '@/lib/superadmin-config';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSuperadmin, SUPERADMIN_PATH } from '@/lib/superadmin';
import { cleanRUT, validateRUT } from '@/lib/utils';
import { sendPushToUsers } from '@/lib/web-push';

const subscriptionSchema = z.object({
  juntaId: z.string().uuid(),
  status: z.enum(['pending', 'authorized', 'paused', 'cancelled', 'past_due']),
  plan: z.enum(['juntapp', 'juntapp_web', 'web']),
  whatsappAddon: z.boolean(),
  price: z.number().int().refine(
    (value) => [9990, 14990, 15000, 17980, 22980, 22990, 30980].includes(value),
    'Precio fuera del catálogo vigente',
  ),
  nextPaymentDate: z.string().nullable(),
  billingMode: z.enum(['subscription', 'trial_then_subscription', 'complimentary']).optional(),
  trialEndsAt: z.string().datetime().nullable().optional(),
  billingNotes: z.string().trim().max(500).nullable().optional(),
});

const suspendSchema = z.object({
  userId: z.string().uuid(),
  suspended: z.boolean(),
});

const broadcastSchema = z.object({
  title: z.string().trim().min(3).max(90),
  message: z.string().trim().min(10).max(1000),
  juntaId: z.string().uuid().nullable(),
  role: z.enum(['all', 'dirigente', 'vecino']),
  plan: z.enum(['all', 'juntapp', 'juntapp_web', 'web']),
  action: z.string().trim().max(200).nullable(),
});

const createJuntaSchema = z.object({
  name: z.string().trim().min(3).max(160),
  address: z.string().trim().min(3).max(300),
  comuna: z.string().trim().min(2).max(100),
  region: z.string().trim().min(2).max(100),
  ownerName: z.string().trim().min(3).max(160),
  ownerEmail: z.email().trim().toLowerCase(),
  ownerRut: z.string().trim().refine(validateRUT, 'RUT inválido'),
  ownerAddress: z.string().trim().min(3).max(300),
  ownerPhone: z.string().trim().max(40).refine(
    (value) => /^(?:56)?9\d{8}$/.test(value.replace(/\D/g, '')),
    'Celular inválido',
  ),
  plan: z.enum(['juntapp', 'juntapp_web', 'web']),
  whatsappAddon: z.boolean(),
  benefit: z.enum(['immediate', 'free_1', 'free_3', 'free_6', 'free_12', 'complimentary']),
  billingNotes: z.string().trim().max(500).optional(),
}).refine((data) => isValidChileLocation(data.region, data.comuna), {
  message: 'La región y comuna no corresponden.',
  path: ['comuna'],
});

export type AdminActionResult = {
  ok: boolean;
  message: string;
};

function slugBase(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'junta';
}

function benefitTerms(benefit: z.infer<typeof createJuntaSchema>['benefit']) {
  if (benefit === 'complimentary') {
    return {
      status: 'authorized' as const,
      billingMode: 'complimentary' as const,
      trialEndsAt: null,
      benefitLabel: 'Cortesía sin vencimiento',
    };
  }
  if (benefit.startsWith('free_')) {
    const months = Number(benefit.slice(5));
    const trialEndsAt = addCalendarMonths(new Date(), months).toISOString();
    return {
      status: 'authorized' as const,
      billingMode: 'trial_then_subscription' as const,
      trialEndsAt,
      benefitLabel: `${months} ${months === 1 ? 'mes gratis' : 'meses gratis'}`,
    };
  }
  return {
    status: 'pending' as const,
    billingMode: 'subscription' as const,
    trialEndsAt: null,
    benefitLabel: 'Cobro inmediato',
  };
}

export async function createJuntaAction(
  input: z.input<typeof createJuntaSchema>,
): Promise<AdminActionResult & { juntaId?: string }> {
  const superadmin = await requireSuperadmin();
  const parsed = createJuntaSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? 'Revisa los datos de la junta y su titular.',
    };
  }

  const admin = createAdminClient();
  const ownerRut = cleanRUT(parsed.data.ownerRut).toUpperCase();
  const [{ data: emailOwner }, { data: rutOwner }] = await Promise.all([
    admin.from('profiles').select('id').ilike('email', parsed.data.ownerEmail).maybeSingle(),
    admin.from('profiles').select('id').eq('rut', ownerRut).maybeSingle(),
  ]);
  if (emailOwner || rutOwner) {
    return { ok: false, message: 'El correo o RUT del titular ya pertenece a una cuenta de JuntAPP.' };
  }

  const terms = benefitTerms(parsed.data.benefit);
  const price = subscriptionPrice(parsed.data.plan, parsed.data.whatsappAddon);
  const base = slugBase(parsed.data.name);
  let junta: { id: string; invite_code: string; slug: string } | null = null;
  let insertError = '';

  for (let attempt = 0; attempt < 5 && !junta; attempt += 1) {
    const inviteCode = randomBytes(5).toString('hex').slice(0, 6).toUpperCase();
    const slug = `${base}-${randomUUID().replaceAll('-', '').slice(0, 8)}`;
    const { data, error } = await admin
      .from('juntas')
      .insert({
        name: parsed.data.name,
        slug,
        address: parsed.data.address,
        comuna: parsed.data.comuna,
        region: parsed.data.region,
        invite_code: inviteCode,
        owner_id: null,
        // The trigger needs an active junta while it creates the invited owner.
        // The definitive commercial status is applied immediately afterwards.
        subscription_status: 'authorized',
        subscription_plan: parsed.data.plan,
        subscription_price: price,
        whatsapp_addon: parsed.data.whatsappAddon,
        billing_mode: terms.billingMode,
        trial_ends_at: terms.trialEndsAt,
        subscription_next_payment_date: terms.trialEndsAt,
        activated_at: terms.status === 'authorized' ? new Date().toISOString() : null,
        billing_notes: parsed.data.billingNotes || null,
      })
      .select('id, invite_code, slug')
      .single();
    if (data) junta = data;
    else if (error?.code !== '23505') insertError = error?.message ?? 'No fue posible crear la junta.';
  }

  if (!junta) return { ok: false, message: insertError || 'No fue posible generar los identificadores de la junta.' };

  let invitedUserId: string | null = null;
  try {
    const { error: authorizationError } = await admin.from('member_invitations').insert({ junta_id: junta.id, email: parsed.data.ownerEmail.toLowerCase(), rut: ownerRut });
    if (authorizationError) throw new Error(authorizationError.message);
    const { data: invited, error: inviteError } = await admin.auth.admin.generateLink({
      type: 'invite',
      email: parsed.data.ownerEmail,
      options: {
        data: {
          name: parsed.data.ownerName,
          rut: ownerRut,
          address: parsed.data.ownerAddress,
          phone: parsed.data.ownerPhone,
          junta_action: 'join',
          invite_code: junta.invite_code,
        },
        redirectTo: `${publicAppUrl()}/aceptar-invitacion`,
      },
    });
    if (inviteError || !invited.user) throw new Error(inviteError?.message ?? 'No fue posible crear al titular.');
    invitedUserId = invited.user.id;

    const { error: profileError } = await admin
      .from('profiles')
      .update({ role: 'dirigente', board_position: 'presidente', cuota_status: 'al_dia' })
      .eq('id', invitedUserId)
      .eq('junta_id', junta.id);
    if (profileError) throw new Error(profileError.message);

    const { error: juntaError } = await admin
      .from('juntas')
      .update({
        owner_id: invitedUserId,
        subscription_status: terms.status,
        billing_mode: terms.billingMode,
        trial_ends_at: terms.trialEndsAt,
        subscription_next_payment_date: terms.trialEndsAt,
        activated_at: terms.status === 'authorized' ? new Date().toISOString() : null,
      })
      .eq('id', junta.id);
    if (juntaError) throw new Error(juntaError.message);

    const inviteEmail = juntaOwnerInviteTemplate({
      name: parsed.data.ownerName,
      juntaName: parsed.data.name,
      planName: parsed.data.plan === 'juntapp_web' ? 'JuntAPP + Página' : parsed.data.plan === 'web' ? 'Solo Página' : 'JuntAPP',
      monthlyPrice: price,
      benefit: terms.benefitLabel,
      billingStartsAt: terms.trialEndsAt,
      actionUrl: authActionUrl(invited.properties),
    });
    const delivery = await sendTransactionalEmail({
      to: parsed.data.ownerEmail,
      ...inviteEmail,
      idempotencyKey: `superadmin-junta-owner:${junta.id}`,
    });
    if (!delivery.delivered) throw new Error('Resend no está configurado para enviar la invitación.');
  } catch (error) {
    if (invitedUserId) await admin.auth.admin.deleteUser(invitedUserId).catch(() => undefined);
    await admin.from('juntas').delete().eq('id', junta.id);
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'No fue posible completar el alta de la junta.',
    };
  }

  console.info('[Superadmin] Junta creada manualmente.', {
    juntaId: junta.id,
    ownerId: invitedUserId,
    createdBy: superadmin.email,
    benefit: parsed.data.benefit,
  });
  revalidatePath(SUPERADMIN_PATH);
  revalidatePath(`${SUPERADMIN_PATH}/juntas`);
  revalidatePath(`${SUPERADMIN_PATH}/suscripciones`);
  return {
    ok: true,
    juntaId: junta.id,
    message: `Junta creada. Enviamos la invitación a ${parsed.data.ownerEmail}.`,
  };
}

export async function updateJuntaSubscriptionAction(
  input: z.input<typeof subscriptionSchema>,
): Promise<AdminActionResult> {
  await requireSuperadmin();
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: 'Los datos de la suscripción no son válidos.' };

  const admin = createAdminClient();
  const { data: current, error: currentError } = await admin
    .from('juntas')
    .select('billing_mode, trial_ends_at, mercadopago_subscription_id')
    .eq('id', parsed.data.juntaId)
    .single();
  if (currentError || !current) return { ok: false, message: 'La junta ya no existe.' };

  const { juntaId, plan, whatsappAddon, price, nextPaymentDate } = parsed.data;
  const billingMode = parsed.data.billingMode ?? current.billing_mode ?? 'subscription';
  const trialEndsAt = parsed.data.trialEndsAt === undefined ? current.trial_ends_at : parsed.data.trialEndsAt;
  let status = parsed.data.status;
  if (billingMode === 'trial_then_subscription') {
    if (!trialEndsAt || new Date(trialEndsAt).getTime() <= Date.now()) {
      return { ok: false, message: 'El período gratuito debe terminar en una fecha futura.' };
    }
    status = 'authorized';
  }
  if (billingMode === 'complimentary') status = 'authorized';
  if (billingMode !== 'subscription' && current.mercadopago_subscription_id) {
    return {
      ok: false,
      message: 'Cancela primero la suscripción vigente de Mercado Pago antes de otorgar un beneficio manual.',
    };
  }

  const { error } = await admin
    .from('juntas')
    .update({
      subscription_status: status,
      subscription_plan: plan,
      whatsapp_addon: whatsappAddon,
      subscription_price: price,
      subscription_next_payment_date: billingMode === 'trial_then_subscription' ? trialEndsAt : nextPaymentDate || null,
      subscription_last_synced_at: new Date().toISOString(),
      billing_mode: billingMode,
      trial_ends_at: billingMode === 'trial_then_subscription' ? trialEndsAt : null,
      trial_warning_sent_at: null,
      trial_expired_at: null,
      ...(parsed.data.billingNotes !== undefined ? { billing_notes: parsed.data.billingNotes || null } : {}),
    })
    .eq('id', juntaId);

  if (error) return { ok: false, message: `No se pudo actualizar: ${error.message}` };

  revalidatePath(SUPERADMIN_PATH);
  revalidatePath(`${SUPERADMIN_PATH}/juntas`);
  revalidatePath(`${SUPERADMIN_PATH}/juntas/${juntaId}`);
  revalidatePath(`${SUPERADMIN_PATH}/suscripciones`);
  return { ok: true, message: 'Suscripción actualizada correctamente.' };
}

export async function setUserSuspendedAction(
  input: z.input<typeof suspendSchema>,
): Promise<AdminActionResult> {
  await requireSuperadmin();
  const parsed = suspendSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: 'Usuario inválido.' };

  const admin = createAdminClient();
  const { data: target } = await admin.auth.admin.getUserById(parsed.data.userId);
  if (isSuperadminEmail(target.user?.email)) {
    return { ok: false, message: 'No puedes suspender una cuenta de superadmin.' };
  }
  const { error } = await admin.auth.admin.updateUserById(parsed.data.userId, {
    ban_duration: parsed.data.suspended ? '876000h' : 'none',
  });

  if (error) return { ok: false, message: `No se pudo cambiar el acceso: ${error.message}` };

  revalidatePath(`${SUPERADMIN_PATH}/usuarios`);
  return {
    ok: true,
    message: parsed.data.suspended ? 'Acceso suspendido.' : 'Acceso restaurado.',
  };
}

export async function sendPlatformBroadcastAction(
  input: z.input<typeof broadcastSchema>,
): Promise<AdminActionResult & { recipients?: number }> {
  const adminUser = await requireSuperadmin();
  const parsed = broadcastSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: 'Revisa el título, mensaje y destinatarios.' };

  const admin = createAdminClient();
  let query = admin.from('profiles').select('id, junta_id, role');
  if (parsed.data.juntaId) query = query.eq('junta_id', parsed.data.juntaId);
  if (parsed.data.role !== 'all') query = query.eq('role', parsed.data.role);

  const { data: profiles, error: profilesError } = await query;
  if (profilesError) return { ok: false, message: `No se pudieron cargar los destinatarios: ${profilesError.message}` };

  let recipients = profiles ?? [];
  if (parsed.data.plan !== 'all') {
    const juntaIds = [...new Set(recipients.map((profile) => profile.junta_id))];
    const { data: juntas, error: juntasError } = await admin
      .from('juntas')
      .select('id')
      .in('id', juntaIds.length ? juntaIds : ['00000000-0000-0000-0000-000000000000'])
      .eq('subscription_plan', parsed.data.plan);
    if (juntasError) return { ok: false, message: `No se pudo aplicar el filtro de plan: ${juntasError.message}` };
    const allowedJuntas = new Set((juntas ?? []).map((junta) => junta.id));
    recipients = recipients.filter((profile) => allowedJuntas.has(profile.junta_id));
  }

  if (recipients.length === 0) return { ok: false, message: 'La segmentación no encontró destinatarios.' };

  const now = new Date().toISOString();
  const rows = recipients.map((profile) => ({
    user_id: profile.id,
    type: 'seguridad',
    title: parsed.data.title,
    message: parsed.data.message,
    read: false,
    date: now,
    action: parsed.data.action || null,
  }));

  for (let index = 0; index < rows.length; index += 500) {
    const { error } = await admin.from('notifications').insert(rows.slice(index, index + 500));
    if (error) return { ok: false, message: `El envío quedó incompleto: ${error.message}` };
  }

  const push = await sendPushToUsers(recipients.map((profile) => profile.id), {
    title: parsed.data.title,
    message: parsed.data.message,
    action: parsed.data.action || '/inicio',
    tag: `comunicado:${Date.now()}`,
  });

  console.info('[Superadmin broadcast]', {
    adminId: adminUser.id,
    recipients: rows.length,
    juntaId: parsed.data.juntaId,
    role: parsed.data.role,
    plan: parsed.data.plan,
    pushDelivered: push.delivered,
  });

  revalidatePath(`${SUPERADMIN_PATH}/comunicaciones`);
  return { ok: true, message: `Comunicado enviado a ${rows.length} personas.`, recipients: rows.length };
}
