import assert from 'node:assert/strict';
import {
  authorizeMemberInvite,
  boardRoleUpdateSchema,
  coherentBoardFields,
  mapBoardRoleDbError,
  planBoardRoleUpdate,
} from '../src/lib/board-role.ts';

const juntaA = '11111111-1111-4111-8111-111111111111';
const juntaB = '22222222-2222-4222-8222-222222222222';

const president = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  junta_id: juntaA,
  role: 'dirigente',
  board_position: 'presidente',
};
const secretary = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  junta_id: juntaA,
  role: 'dirigente',
  board_position: 'secretario',
};
const treasurer = {
  id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  junta_id: juntaA,
  role: 'dirigente',
  board_position: 'tesorero',
};
const boardMember = {
  id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  junta_id: juntaA,
  role: 'dirigente',
  board_position: 'dirigente',
};
const neighbor = {
  id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  junta_id: juntaA,
  role: 'vecino',
  board_position: null,
};
const otherJuntaNeighbor = {
  id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
  junta_id: juntaB,
  role: 'vecino',
  board_position: null,
};

const promoteSecretary = planBoardRoleUpdate(president, neighbor, 'secretario');
assert.equal(promoteSecretary.ok, true);
assert.deepEqual(
  promoteSecretary.ok ? { role: promoteSecretary.role, board_position: promoteSecretary.board_position } : null,
  { role: 'dirigente', board_position: 'secretario' },
  '1. Presidente promueve vecino -> Secretario',
);

const promoteTreasurer = planBoardRoleUpdate(president, { ...neighbor, id: treasurer.id }, 'tesorero');
assert.equal(promoteTreasurer.ok, true);
assert.deepEqual(
  promoteTreasurer.ok ? { role: promoteTreasurer.role, board_position: promoteTreasurer.board_position } : null,
  { role: 'dirigente', board_position: 'tesorero' },
  '2. Presidente promueve vecino -> Tesorero',
);

const promoteBoardMember = planBoardRoleUpdate(president, { ...neighbor, id: boardMember.id }, 'dirigente');
assert.equal(promoteBoardMember.ok, true);
assert.deepEqual(
  promoteBoardMember.ok ? { role: promoteBoardMember.role, board_position: promoteBoardMember.board_position } : null,
  { role: 'dirigente', board_position: 'dirigente' },
  '3. Presidente promueve vecino -> Dirigente',
);

const changeSecretary = planBoardRoleUpdate(president, secretary, 'dirigente');
assert.equal(changeSecretary.ok, true);
assert.deepEqual(
  changeSecretary.ok ? { role: changeSecretary.role, board_position: changeSecretary.board_position } : null,
  { role: 'dirigente', board_position: 'dirigente' },
  '4. Presidente cambia Secretario -> Dirigente',
);

const removeTreasurer = planBoardRoleUpdate(president, treasurer, null);
assert.equal(removeTreasurer.ok, true);
assert.deepEqual(
  removeTreasurer.ok ? { role: removeTreasurer.role, board_position: removeTreasurer.board_position } : null,
  { role: 'vecino', board_position: null },
  '5. Presidente quita Tesorero -> vecino',
);

assert.deepEqual(coherentBoardFields(null), { role: 'vecino', board_position: null }, '6. vecino => board_position NULL');
assert.deepEqual(coherentBoardFields('secretario'), { role: 'dirigente', board_position: 'secretario' }, '6. dirigente => board_position válido');
assert.deepEqual(coherentBoardFields('tesorero'), { role: 'dirigente', board_position: 'tesorero' });
assert.deepEqual(coherentBoardFields('dirigente'), { role: 'dirigente', board_position: 'dirigente' });

assert.equal(
  mapBoardRoleDbError({ code: '23505', message: 'duplicate key value violates unique constraint "one_secretary_per_junta"' }),
  'Ese cargo ya está ocupado en la junta.',
  '7. Secretario ocupado no expone el error PostgreSQL',
);
assert.equal(
  mapBoardRoleDbError({ code: '23505', message: 'duplicate key value violates unique constraint "one_treasurer_per_junta"' }),
  'Ese cargo ya está ocupado en la junta.',
  '8. Tesorero ocupado no expone el error PostgreSQL',
);

const nonPresident = planBoardRoleUpdate(boardMember, neighbor, 'secretario');
assert.equal(nonPresident.ok, false);
assert.equal(nonPresident.ok ? null : nonPresident.status, 403, '9. Dirigente no presidente recibe 403');

const neighborActor = planBoardRoleUpdate(neighbor, secretary, 'dirigente');
assert.equal(neighborActor.ok, false);
assert.equal(neighborActor.ok ? null : neighborActor.status, 403, '10. Vecino recibe 403');

const crossJunta = planBoardRoleUpdate(president, otherJuntaNeighbor, 'secretario');
assert.equal(crossJunta.ok, false);
assert.equal(crossJunta.ok ? null : crossJunta.status, 404, '11. Junta A no modifica Junta B');

const changePresident = planBoardRoleUpdate(president, { ...president, id: '99999999-9999-4999-8999-999999999999' }, 'dirigente');
assert.equal(changePresident.ok, false);
assert.equal(changePresident.ok ? null : changePresident.status, 409, '12. No se puede modificar al Presidente');

const selfPresident = planBoardRoleUpdate(president, president, null);
assert.equal(selfPresident.ok, false);
assert.equal(selfPresident.ok ? null : selfPresident.status, 409, '12. Presidencia no se quita a sí misma');

const secretaryInvite = authorizeMemberInvite(secretary, 'dirigente', 'tesorero');
assert.equal(secretaryInvite.ok, false);
assert.equal(secretaryInvite.ok ? null : secretaryInvite.status, 403, '13. Secretario no puede crear dirigentes');

const treasurerInvite = authorizeMemberInvite(treasurer, 'dirigente', 'dirigente');
assert.equal(treasurerInvite.ok, false);
assert.equal(treasurerInvite.ok ? null : treasurerInvite.status, 403, '13. Tesorero no puede crear dirigentes');

const boardInvite = authorizeMemberInvite(boardMember, 'dirigente', 'secretario');
assert.equal(boardInvite.ok, false);
assert.equal(boardInvite.ok ? null : boardInvite.status, 403, '13. Dirigente no puede crear dirigentes');

const neighborInvite = authorizeMemberInvite(secretary, 'vecino');
assert.equal(neighborInvite.ok, true, '14. Directiva puede seguir invitando vecinos');
assert.equal(authorizeMemberInvite(treasurer, 'vecino').ok, true);
assert.equal(authorizeMemberInvite(boardMember, 'vecino').ok, true);
assert.equal(authorizeMemberInvite(president, 'vecino').ok, true, '14. Presidencia también puede invitar vecinos');
assert.equal(authorizeMemberInvite(president, 'dirigente', 'secretario').ok, true, 'Presidencia sí puede invitar dirigentes');
assert.equal(authorizeMemberInvite(president, 'dirigente', 'presidente').ok, false);
assert.equal(authorizeMemberInvite(neighbor, 'vecino').ok, false);

assert.equal(boardRoleUpdateSchema.safeParse({ boardPosition: 'secretario' }).success, true);
assert.equal(boardRoleUpdateSchema.safeParse({ boardPosition: 'tesorero' }).success, true);
assert.equal(boardRoleUpdateSchema.safeParse({ boardPosition: 'dirigente' }).success, true);
assert.equal(boardRoleUpdateSchema.safeParse({ boardPosition: null }).success, true);
assert.equal(boardRoleUpdateSchema.safeParse({ boardPosition: 'presidente' }).success, false, 'Zod rechaza Presidencia');
assert.equal(boardRoleUpdateSchema.safeParse({}).success, false);

console.log('Board role management tests passed.');
