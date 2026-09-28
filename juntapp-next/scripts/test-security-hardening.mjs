import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration = fs.readFileSync('../backend/supabase/migrations/20260927000000_security_integrity_hardening.sql', 'utf8');
const inviteRoute = fs.readFileSync('src/app/api/members/invite/route.ts', 'utf8');
const votes = fs.readFileSync('src/components/dashboard/votaciones/VotacionesClient.tsx', 'utf8');
const legacyDb = fs.readFileSync('../frontend/src/js/db.js', 'utf8');

assert.match(migration, /La invitacion debe ser emitida por la directiva/);
assert.doesNotMatch(inviteRoute, /manual_invite/);
assert.match(migration, /REVOKE ALL ON public\.member_invitations FROM anon, authenticated/);
assert.match(migration, /handle_new_user\(\)/);
assert.match(migration, /used_at IS NULL/);
assert.match(migration, /FOR UPDATE/);
assert.match(migration, /approved_application UUID/);
assert.match(migration, /cast_anonymous_vote/);
assert.match(votes, /cast_anonymous_vote/);
assert.match(legacyDb, /rpc\('cast_anonymous_vote'/);
assert.match(legacyDb, /rpc\('poll_results'/);
assert.doesNotMatch(legacyDb, /\.from\(['"]votes['"]\)/);
assert.match(migration, /poll_participation/);
assert.match(migration, /ALTER TABLE public\.votes ALTER COLUMN user_id DROP NOT NULL/);
assert.match(migration, /UPDATE public\.votes SET user_id=NULL/);
assert.match(migration, /REVOKE ALL ON public\.votes FROM anon, authenticated/);
assert.match(migration, /protect_junta_server_fields/);
assert.match(migration, /monthly_due_amount/);
assert.match(migration, /Solo Presidencia o Tesoreria/);
assert.match(migration, /membership_status=''active''|membership_status='active'/);
assert.match(migration, /current_chile_date/);
assert.match(migration, /date_trunc\('month',public\.current_chile_date\(\)\)/);

const chilePeriod = (date) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit' }).formatToParts(date);
  return `${parts.find((p) => p.type === 'year').value}-${parts.find((p) => p.type === 'month').value}`;
};
assert.equal(chilePeriod(new Date('2026-10-01T02:30:00Z')), '2026-09');
assert.equal(chilePeriod(new Date('2026-01-01T02:30:00Z')), '2025-12');
console.log('security hardening checks passed');
