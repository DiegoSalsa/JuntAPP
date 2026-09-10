import type { BoardPosition } from '@/lib/types';

export const BOARD_POSITIONS: { value: BoardPosition; label: string }[] = [
  { value: 'presidente', label: 'Presidente' },
  { value: 'secretario', label: 'Secretario' },
  { value: 'tesorero', label: 'Tesorero' },
  { value: 'dirigente', label: 'Dirigente' },
];

export const ASSIGNABLE_BOARD_POSITIONS = BOARD_POSITIONS.filter(
  (item): item is { value: Exclude<BoardPosition, 'presidente'>; label: string } => item.value !== 'presidente',
);

export function boardPositionLabel(position: BoardPosition | null | undefined) {
  return BOARD_POSITIONS.find((item) => item.value === position)?.label ?? 'Dirigente';
}
