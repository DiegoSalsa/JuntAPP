import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const inicioPage = read('src', 'app', '(dashboard)', 'inicio', 'page.tsx');
const membershipReview = read('src', 'lib', 'membership-review.ts');
const inicio = read('src', 'components', 'dashboard', 'inicio', 'InicioV2.tsx');
const alerts = read('src', 'components', 'dashboard', 'inicio', 'InicioAlerts.tsx');
const polls = read('src', 'components', 'dashboard', 'votaciones', 'VotacionesClient.tsx');
const shell = read('src', 'components', 'original', 'OriginalDashboardShell.tsx');
const fixture = read('scripts', 'fixtures', 'ux-ui-v2-data.mjs');
const fixtureServer = read('scripts', 'fixtures', 'dues-ui.mjs');
const socios = read('src', 'components', 'dashboard', 'socios', 'SociosClient.tsx');
const builder = read('src', 'components', 'website', 'WebsiteBuilder.tsx');
const treasury = read('src', 'components', 'dashboard', 'tesoreria', 'TesoreriaClient.tsx');

// Dashboard indicators: errors and multiple rows must remain distinguishable from real zeroes.
assert.match(inicioPage, /profile\?\.role === 'dirigente'/);
assert.ok(inicioPage.indexOf("select('id', { count: 'exact'") > inicioPage.indexOf("profile?.role === 'dirigente'"), 'profile count must be role-gated');
assert.match(inicioPage, /\.select\('id, title'\)[\s\S]*\.limit\(3\)/);
const activePollQuery = inicioPage.slice(inicioPage.indexOf("supabase.from('polls')"), inicioPage.indexOf("supabase.from('polls')") + 260);
assert.doesNotMatch(activePollQuery, /maybeSingle/);
assert.match(inicioPage, /select\('id', \{ count: 'exact', head: true \}\)\.eq\('junta_id', juntaId\)\.eq\('active', true\)/);
assert.match(inicioPage, /activePollsCount/);
assert.match(inicioPage, /supabase\.rpc\('junta_has_secretary'\)/);
assert.match(inicioPage, /!hasSecretaryError[\s\S]*canReviewMembershipApplications\(profile, Boolean\(hasSecretary\)/);
assert.match(membershipReview, /if \(member\.role !== 'dirigente'\) return false/);
assert.match(membershipReview, /return !hasSecretary[\s\S]*member\.board_position === 'presidente'/);
assert.match(inicio, /Domicilios registrados/);
assert.match(inicio, /Sin información/);
assert.match(inicio, /activePollsError/);
assert.match(inicio, /activePollsCount/);
assert.match(inicio, /canReviewApplications/);

// Compact PWA setup keeps installation and push actions available on demand.
assert.match(alerts, /detailsOpen/);
assert.match(alerts, /details-compact/);
assert.match(alerts, /Ver opciones/);

// Multiple active consultations are rendered independently and submit the selected poll id.
assert.match(polls, /const activePolls = polls\.filter\(\(poll\) => poll\.active\)/);
assert.match(polls, /selectedByPoll/);
assert.match(polls, /handleVote\(event, poll\)/);
assert.match(polls, /active-polls-stack/);
assert.match(fixture, /poll-fixture-2/);
assert.match(fixtureServer, /visualData\.polls\.flatMap/);

// UX structures remain semantic and mobile-safe.
assert.match(shell, /mobile-primary-nav|mobile-navigation-menu/);
assert.match(socios, /roster-workspace/);
assert.match(treasury, /ledger-mobile-list/);
assert.match(builder, /role="tablist"/);
assert.match(builder, /aria-selected/);

console.log('PASS UX/UI V2 regression contracts');
console.log('PASS indicator error states and role-aware actions');
console.log('PASS multiple active consultations fixture and rendering contract');
console.log('PASS mobile roster, ledger, dialogs and website builder contracts');
