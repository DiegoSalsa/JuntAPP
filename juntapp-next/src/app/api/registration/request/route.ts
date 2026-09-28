import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { juntaHasActiveAccess } from '@/lib/junta-billing';
import { expireJuntaTrialIfNeeded } from '@/lib/junta-trial';
import { cleanRUT, validateRUT } from '@/lib/utils';
import { rateLimit } from '@/lib/rate-limit';
import { sendRegistrationLetter } from '@/lib/registration-letter';
import { sendPushToUsers } from '@/lib/web-push';
import { selectMembershipReviewer } from '@/lib/membership-review';

const schema = z.object({
  name: z.string().trim().min(3).max(160),
  rut: z.string().trim().refine(validateRUT),
  address: z.string().trim().min(3).max(300),
  phone: z.string().trim().max(40).refine((value) => /^(?:56)?9\d{8}$/.test(value.replace(/\D/g, ''))),
  email: z.email().trim().toLowerCase(),
  inviteCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{6}$/),
});

export async function POST(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  if (!(await rateLimit(`membership-request:${forwardedFor}`, 5, 60 * 60_000)).allowed) {
    return NextResponse.json({ error: 'Alcanzaste el límite de solicitudes. Intenta más tarde.' }, { status: 429 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Revisa los datos de la solicitud.' }, { status: 400 });

  const admin = createAdminClient();
  const rut = cleanRUT(parsed.data.rut).toUpperCase();
  const { data: junta } = await admin.from('juntas').select('id, name, owner_id, subscription_status, billing_mode, trial_ends_at').eq('invite_code', parsed.data.inviteCode).maybeSingle();
  if (!junta) return NextResponse.json({ error: 'El código no corresponde a una junta registrada.' }, { status: 404 });
  const currentJunta = await expireJuntaTrialIfNeeded(junta);
  if (!juntaHasActiveAccess(currentJunta)) return NextResponse.json({ error: 'La junta no tiene una suscripción activa.' }, { status: 409 });

  const [{ data: existingProfile }, { data: existingApplication }, { data: board }] = await Promise.all([
    admin.from('profiles').select('id').or(`rut.eq.${rut},email.ilike.${parsed.data.email}`).maybeSingle(),
    admin.from('membership_applications').select('id').eq('junta_id', currentJunta.id).eq('status', 'pending').or(`rut.eq.${rut},email.ilike.${parsed.data.email}`).maybeSingle(),
    admin.from('profiles').select('id, email, board_position').eq('junta_id', currentJunta.id).eq('role', 'dirigente'),
  ]);
  if (existingProfile) return NextResponse.json({ error: 'El RUT o correo ya pertenece a un socio registrado.' }, { status: 409 });
  if (existingApplication) return NextResponse.json({ error: 'Ya existe una solicitud pendiente para este RUT o correo.' }, { status: 409 });
  const reviewer = selectMembershipReviewer(board ?? [], currentJunta.owner_id);
  if (!reviewer) return NextResponse.json({ error: 'La junta aún no tiene una directiva habilitada para revisar solicitudes.' }, { status: 409 });

  const { data: application, error } = await admin.from('membership_applications').insert({
    junta_id: currentJunta.id, name: parsed.data.name, rut, address: parsed.data.address,
    phone: parsed.data.phone, email: parsed.data.email,
  }).select('*').single();
  if (error || !application) return NextResponse.json({ error: error?.message ?? 'No fue posible crear la solicitud.' }, { status: 400 });

  await admin.from('notifications').insert((board ?? []).map((member) => ({
    user_id: member.id,
    type: 'registro',
    title: member.id === reviewer.id ? 'Solicitud pendiente de tu aprobación' : 'Copia: nueva solicitud de socio',
    message: `${application.name} solicita ingresar desde ${application.address}. ${member.id === reviewer.id ? 'Revisa y resuelve la solicitud.' : 'La persona responsable de la directiva debe resolverla.'}`,
    read: false, date: new Date().toISOString(), action: '/socios',
  })));
  await sendPushToUsers((board ?? []).map((member) => member.id), {
    title: 'Nueva solicitud de socio',
    message: `${application.name} solicita ingresar desde ${application.address}.`,
    action: '/socios',
    tag: `registro:${application.id}`,
  });

  let deliveryStatus: 'sent' | 'in_app' | 'failed' = 'in_app';
  try {
    const delivery = await sendRegistrationLetter({
      reviewerEmail: reviewer.email, boardEmails: (board ?? []).map((member) => member.email),
      juntaName: currentJunta.name, applicantName: application.name, applicantRut: application.rut,
      applicantAddress: application.address, applicantPhone: application.phone,
      applicantEmail: application.email, applicationId: application.id,
    });
    deliveryStatus = delivery.delivered ? 'sent' : 'in_app';
  } catch { deliveryStatus = 'failed'; }
  await admin.from('membership_applications').update({ letter_delivery_status: deliveryStatus }).eq('id', application.id);
  return NextResponse.json({ applicationId: application.id, status: 'pending', message: 'Solicitud enviada a la directiva. Cuando sea aprobada, recibirás un correo para activar tu cuenta y crear una contraseña segura de al menos 8 caracteres.' }, { status: 201 });
}
