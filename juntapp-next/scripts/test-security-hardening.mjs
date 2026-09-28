import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration = fs.readFileSync('../backend/supabase/migrations/20260927000000_security_integrity_hardening.sql', 'utf8');
const inviteRoute = fs.readFileSync('src/app/api/members/invite/route.ts', 'utf8');
const votes = fs.readFileSync('src/components/dashboard/votaciones/VotacionesClient.tsx', 'utf8');
assert.match(migration, /La invitacion debe ser emitida por la directiva/);
assert.doesNotMatch(inviteRoute, /manual_invite/);
assert.match(migration, /cast_anonymous_vote/);
assert.match(votes, /cast_anonymous_vote/);
assert.match(migration, /protect_junta_server_fields/);
assert.match(migration, /membership_status/);
const chilePeriod = (date) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit' }).formatToParts(date);
  return `${parts.find((p) => p.type === 'year').value}-${parts.find((p) => p.type === 'month').value}`;
};
assert.equal(chilePeriod(new Date('2026-10-01T02:30:00Z')), '2026-09');
assert.equal(chilePeriod(new Date('2026-01-01T02:30:00Z')), '2025-12');
console.log('security hardening checks passed');
