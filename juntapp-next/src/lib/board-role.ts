import { z } from 'zod';
import type { BoardPosition, UserRole } from './types';

export type AssignableBoardPosition = Exclude<BoardPosition, 'presidente'>;

export const ASSIGNABLE_BOARD_POSITION_VALUES = ['secretario', 'tesorero', 'dirigente'] as const;

export const assignableBoardPositionSchema = z.enum(ASSIGNABLE_BOARD_POSITION_VALUES);

export const boardRoleUpdateSchema = z.object({
  boardPosition: assignableBoardPositionSchema.nullable(),
});

export type BoardActor = {
  id: string;
  junta_id: string;
  role: UserRole;
  board_position: BoardPosition | null;
};

export function isPresidency(profile: Pick<BoardActor, 'role' | 'board_position'>) {
  return profile.role === 'dirigente' && profile.board_position === 'presidente';
}

export function coherentBoardFields(boardPosition: AssignableBoardPosition | null) {
  if (boardPosition === null) {
    return { role: 'vecino' as const, board_position: null };
  }
  return { role: 'dirigente' as const, board_position: boardPosition };
}

export function authorizeBoardRoleMutation(actor: BoardActor, target: BoardActor) {
  if (!isPresidency(actor)) {
    return { ok: false as const, status: 403, error: 'Solo Presidencia puede administrar cargos de la directiva.' };
  }
  if (actor.junta_id !== target.junta_id) {
    return { ok: false as const, status: 404, error: 'Vecino no encontrado en tu junta.' };
  }
  if (target.id === actor.id || isPresidency(target)) {
    return { ok: false as const, status: 409, error: 'La Presidencia no se administra desde esta función.' };
  }
  return { ok: true as const };
}

export function planBoardRoleUpdate(
  actor: BoardActor,
  target: BoardActor,
  boardPosition: AssignableBoardPosition | null,
) {
  const authorization = authorizeBoardRoleMutation(actor, target);
  if (!authorization.ok) return authorization;
  return { ok: true as const, ...coherentBoardFields(boardPosition) };
}

export function authorizeMemberInvite(
  actor: Pick<BoardActor, 'role' | 'board_position'>,
  role: UserRole,
  boardPosition?: AssignableBoardPosition | BoardPosition | null,
) {
  if (actor.role !== 'dirigente') {
    return { ok: false as const, status: 403, error: 'Se requiere rol de dirigente.' };
  }
  if (role === 'vecino') {
    return { ok: true as const };
  }
  if (!isPresidency(actor)) {
    return { ok: false as const, status: 403, error: 'Solo Presidencia puede invitar dirigentes o asignar cargos.' };
  }
  if (boardPosition === 'presidente') {
    return { ok: false as const, status: 400, error: 'La Presidencia no se transfiere desde esta función.' };
  }
  if (!boardPosition || !ASSIGNABLE_BOARD_POSITION_VALUES.includes(boardPosition as AssignableBoardPosition)) {
    return { ok: false as const, status: 400, error: 'El cargo es obligatorio para dirigentes.' };
  }
  return { ok: true as const };
}

export function mapBoardRoleDbError(error: { code?: string; message?: string }) {
  if (error.code === '23505') return 'Ese cargo ya está ocupado en la junta.';
  return error.message || 'No fue posible actualizar el cargo.';
}
