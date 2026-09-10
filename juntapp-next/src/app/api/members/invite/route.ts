import { NextResponse } from 'next/server';
import { z } from 'zod';
import { cleanRUT, validateRUT } from '@/lib/utils';
import { rateLimit } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { authActionUrl, publicAppUrl, sendTransactionalEmail } from '@/lib/email';
import { membershipInviteTemplate } from '@/lib/email-templates';
import { assignableBoardPositionSchema, authorizeMemberInvite } from '@/lib/board-role';

const memberSchema = z.object({
  name: z.string().trim().min(3).max(160),
  rut: z.string().trim().refine(validateRUT, 'RUT inválido'),
  address: z.string().trim().min(3).max(300),
  phone: z.string().trim().max(40).refine((value) => /^(?:56)?9\d{8}$/.test(value.replace(/\D/g, '')), 'Celular inválido'),
  email: z.email(),
  role: z.enum(['vecino', 'dirigente']).default('vecino'),
  boardPosition: assignableBoardPositionSchema.optional(),
}).refine((data) => data.role === 'vecino' || Boolean(data.boardPosition), {
  message: 'El cargo es obligatorio para dirigentes.',
  path: ['boardPosition'],
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const limit = rateLimit(`member-invite:${user.id}`, 10, 60 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Límite de invitaciones alcanzado. Intenta más tarde.' }, { status: 429 });
  }

  const parsed = memberSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Revisa los datos del socio.', details: z.flattenError(parsed.error) }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, board_position, junta_id, juntas(invite_code, name)')
    .eq('id', user.id)
    .single();

  const junta = Array.isArray(profile?.juntas) ? profile.juntas[0] : profile?.juntas;
  if (!profile || !junta?.invite_code) {
    return NextResponse.json({ error: 'Se requiere rol de dirigente.' }, { status: 403 });
  }
  const inviteAuthorization = authorizeMemberInvite(profile, parsed.data.role, parsed.data.boardPosition);
  if (!inviteAuthorization.ok) {
    return NextResponse.json({ error: inviteAuthorization.error }, { status: inviteAuthorization.status });
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'invite',
      email: parsed.data.email,
      options: {
        data: {
          name: parsed.data.name,
          rut: cleanRUT(parsed.data.rut),
          address: parsed.data.address,
          phone: parsed.data.phone,
          junta_action: 'join',
          invite_code: junta.invite_code,
          manual_invite: true,
        },
        redirectTo: `${publicAppUrl()}/aceptar-invitacion`,
      },
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (parsed.data.role === 'dirigente') {
      const { error: roleError } = await admin.from('profiles').update({
        role: 'dirigente',
        board_position: parsed.data.boardPosition,
        cuota_status: 'pendiente',
      }).eq('id', data.user.id).eq('junta_id', profile.junta_id);
      if (roleError) {
        await admin.auth.admin.deleteUser(data.user.id);
        const message = roleError.code === '23505' ? 'Ese cargo ya está ocupado en la junta.' : roleError.message;
        return NextResponse.json({ error: message }, { status: 409 });
      }
    }
    try {
      const inviteEmail = membershipInviteTemplate({
        name: parsed.data.name,
        juntaName: junta.name,
        actionUrl: authActionUrl(data.properties),
      });
      const delivery = await sendTransactionalEmail({
        to: parsed.data.email,
        ...inviteEmail,
        idempotencyKey: `manual-member-invite:${data.user.id}`,
      });
      if (!delivery.delivered) throw new Error('Resend no está configurado.');
    } catch (error) {
      await admin.auth.admin.deleteUser(data.user.id);
      throw error;
    }
    return NextResponse.json({ id: data.user.id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No fue posible enviar la invitación.';
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
