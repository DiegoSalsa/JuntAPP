import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimit } from '@/lib/rate-limit';
import {
  boardRoleUpdateSchema,
  mapBoardRoleDbError,
  planBoardRoleUpdate,
  type BoardActor,
} from '@/lib/board-role';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const targetId = (await params).id;
  if (!z.uuid().safeParse(targetId).success) {
    return NextResponse.json({ error: 'Identificador inválido.' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 });
  if (!rateLimit(`board-role:${user.id}`, 20, 60_000).allowed) {
    return NextResponse.json({ error: 'Espera un momento antes de cambiar otro cargo.' }, { status: 429 });
  }

  const parsed = boardRoleUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Selecciona un cargo válido de directiva.' }, { status: 400 });
  }

  const { data: actor } = await supabase
    .from('profiles')
    .select('id, junta_id, role, board_position')
    .eq('id', user.id)
    .single();
  if (!actor) return NextResponse.json({ error: 'No encontramos tu perfil.' }, { status: 403 });

  const admin = createAdminClient();
  const { data: target } = await admin
    .from('profiles')
    .select('id, junta_id, role, board_position, name')
    .eq('id', targetId)
    .maybeSingle();
  if (!target) return NextResponse.json({ error: 'Vecino no encontrado en tu junta.' }, { status: 404 });

  const planned = planBoardRoleUpdate(actor as BoardActor, target as BoardActor, parsed.data.boardPosition);
  if (!planned.ok) return NextResponse.json({ error: planned.error }, { status: planned.status });

  const { data: updated, error } = await admin
    .from('profiles')
    .update({ role: planned.role, board_position: planned.board_position })
    .eq('id', target.id)
    .eq('junta_id', actor.junta_id)
    .select('id, name, role, board_position')
    .maybeSingle();
  if (error) {
    const message = mapBoardRoleDbError(error);
    return NextResponse.json({ error: message }, { status: error.code === '23505' ? 409 : 400 });
  }
  if (!updated) return NextResponse.json({ error: 'Vecino no encontrado en tu junta.' }, { status: 404 });

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    role: updated.role,
    boardPosition: updated.board_position,
  });
}
