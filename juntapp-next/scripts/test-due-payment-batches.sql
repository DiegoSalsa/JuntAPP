\set ON_ERROR_STOP on
\set junta_id '11111111-1111-4111-8111-111111111111'
\set household_id '22222222-2222-4222-8222-222222222222'
\set actor_id '33333333-3333-4333-8333-333333333333'
\set new_household_id '44444444-4444-4444-8444-444444444444'
\set neighbor_a_id '66666666-6666-4666-8666-666666666666'
\set inactive_neighbor_a_id '77777777-7777-4777-8777-777777777777'
\set dirigente_b_id '88888888-8888-4888-8888-888888888888'
\set junta_b_id '99999999-9999-4999-8999-999999999999'
\set neighbor_household_id 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
\set inactive_household_id 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
\set dirigente_b_household_id 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

-- Fixture writes are administrative and occur only in the disposable DB.
SELECT set_config('request.jwt.claim.role', 'service_role', false);

ALTER TABLE auth.users DISABLE TRIGGER USER;
INSERT INTO auth.users (id, email, raw_user_meta_data, raw_app_meta_data, aud, role, email_confirmed_at, created_at, updated_at)
VALUES (:'actor_id', 'due-test@example.invalid', '{"name":"Due Test"}', '{}', 'authenticated', 'authenticated', now(), now(), now())
ON CONFLICT (id) DO NOTHING;
ALTER TABLE auth.users ENABLE TRIGGER USER;

INSERT INTO public.juntas (id, name, slug, region, invite_code, monthly_due_amount, subscription_status)
VALUES (:'junta_id', 'Junta de Pruebas Cuotas', 'due-test-junta', 'Metropolitana', 'DUE123', 10000, 'authorized')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.households (id, junta_id, address, normalized_address, created_at)
VALUES (:'household_id', :'junta_id', 'Pasaje Prueba 123', 'pasaje prueba 123', now() - interval '2 months')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (id, name, rut, address, email, role, cuota_status, junta_id, household_id, membership_status, board_position)
VALUES (:'actor_id', 'Due Test', '99.999.991-1', 'Pasaje Prueba 123', 'due-test@example.invalid', 'dirigente', 'pendiente', :'junta_id', :'household_id', 'active', 'tesorero')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.households (id, junta_id, address, normalized_address, created_at)
VALUES (:'new_household_id', :'junta_id', 'Pasaje Nuevo 456', 'pasaje nuevo 456', date_trunc('month', CURRENT_DATE) + interval '14 days')
ON CONFLICT (id) DO NOTHING;
UPDATE public.profiles
SET junta_id=:'junta_id', household_id=:'household_id', role='dirigente', board_position='tesorero', membership_status='active', name='Due Test', rut='99.999.991-1', address='Pasaje Prueba 123', email='due-test@example.invalid'
WHERE id=:'actor_id';

ALTER TABLE auth.users DISABLE TRIGGER USER;
INSERT INTO auth.users (id, email, raw_user_meta_data, raw_app_meta_data, aud, role, email_confirmed_at, created_at, updated_at)
VALUES
  (:'neighbor_a_id', 'neighbor-a@example.invalid', '{"name":"Vecino A"}', '{}', 'authenticated', 'authenticated', now(), now(), now()),
  (:'inactive_neighbor_a_id', 'inactive-a@example.invalid', '{"name":"Vecino Inactivo A"}', '{}', 'authenticated', 'authenticated', now(), now(), now()),
  (:'dirigente_b_id', 'dirigente-b@example.invalid', '{"name":"Dirigente B"}', '{}', 'authenticated', 'authenticated', now(), now(), now())
ON CONFLICT (id) DO NOTHING;
ALTER TABLE auth.users ENABLE TRIGGER USER;

INSERT INTO public.juntas (id, name, slug, region, invite_code, monthly_due_amount, subscription_status)
VALUES (:'junta_b_id', 'Junta de Pruebas B', 'due-test-junta-b', 'Metropolitana', 'DUE999', 10000, 'authorized')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.households (id, junta_id, address, normalized_address, created_at)
VALUES
  (:'neighbor_household_id', :'junta_id', 'Pasaje Vecino A 10', 'pasaje vecino a 10', now() - interval '3 months'),
  (:'inactive_household_id', :'junta_id', 'Pasaje Vecino Inactivo 20', 'pasaje vecino inactivo 20', now() - interval '4 months'),
  (:'dirigente_b_household_id', :'junta_b_id', 'Pasaje Junta B 30', 'pasaje junta b 30', now() - interval '5 months')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (id, name, rut, address, email, role, cuota_status, junta_id, household_id, membership_status, board_position)
VALUES
  (:'neighbor_a_id', 'Vecino A', '99.999.992-1', 'Pasaje Vecino A 10', 'neighbor-a@example.invalid', 'vecino', 'pendiente', :'junta_id', :'neighbor_household_id', 'active', NULL),
  (:'inactive_neighbor_a_id', 'Vecino Inactivo A', '99.999.993-1', 'Pasaje Vecino Inactivo 20', 'inactive-a@example.invalid', 'vecino', 'pendiente', :'junta_id', :'inactive_household_id', 'inactive', NULL),
  (:'dirigente_b_id', 'Dirigente B', '99.999.994-1', 'Pasaje Junta B 30', 'dirigente-b@example.invalid', 'dirigente', 'pendiente', :'junta_b_id', :'dirigente_b_household_id', 'active', 'tesorero')
ON CONFLICT (id) DO UPDATE SET junta_id=excluded.junta_id, household_id=excluded.household_id, role=excluded.role, membership_status=excluded.membership_status, board_position=excluded.board_position;
-- Deliberately make the owner a vecino for the negative authorization case:
-- ownership alone must never grant roster or other-household history access.
RESET ROLE;
UPDATE public.juntas SET owner_id = :'neighbor_a_id' WHERE id = :'junta_id';

SELECT set_config('request.jwt.claim.sub', :'actor_id', false);
SELECT set_config('request.jwt.claim.role', 'service_role', false);
SET ROLE service_role;

DO $$
DECLARE
  p0 date := date_trunc('month', CURRENT_DATE)::date;
  periods date[] := ARRAY[p0, (p0 + interval '1 month')::date, (p0 + interval '2 months')::date];
  b1 uuid; b2 uuid; b3 uuid; b4 uuid; b5 uuid; b6 uuid; b7 uuid;
  tx bigint; reverse_tx bigint; claim jsonb;
  paid_count integer; pending_count integer; new_paid_count integer;
BEGIN
  SELECT batch_id, transaction_id INTO b1, tx
  FROM public.record_manual_due_payment_batch('11111111-1111-4111-8111-111111111111'::uuid, '22222222-2222-4222-8222-222222222222'::uuid, periods, 'transfer', '33333333-3333-4333-8333-333333333333'::uuid);
  SELECT count(*) INTO paid_count FROM public.member_dues WHERE household_id='22222222-2222-4222-8222-222222222222'::uuid AND period=ANY(periods) AND status='paid' AND payment_source='manual';
  IF paid_count <> 3 THEN RAISE EXCEPTION 'manual payment did not cover the complete three-period batch'; END IF;

  SELECT public.reverse_manual_household_dues('11111111-1111-4111-8111-111111111111'::uuid, '22222222-2222-4222-8222-222222222222'::uuid, periods, '33333333-3333-4333-8333-333333333333'::uuid) INTO reverse_tx;
  IF reverse_tx IS NULL THEN RAISE EXCEPTION 'manual reversal did not create a transaction'; END IF;
  SELECT count(*) INTO pending_count FROM public.member_dues WHERE household_id='22222222-2222-4222-8222-222222222222'::uuid AND period=ANY(periods) AND status='pending';
  IF pending_count <> 3 OR (SELECT status FROM public.due_payment_batches WHERE id=b1) <> 'reversed' THEN
    RAISE EXCEPTION 'manual reversal did not reopen the complete batch';
  END IF;

  SELECT batch_id, transaction_id INTO b2, tx
  FROM public.record_manual_due_payment_batch('11111111-1111-4111-8111-111111111111'::uuid, '22222222-2222-4222-8222-222222222222'::uuid, periods, 'cash', '33333333-3333-4333-8333-333333333333'::uuid);
  IF b2 = b1 THEN RAISE EXCEPTION 'recovery reused the closed batch'; END IF;

  SELECT public.create_due_payment_batch('11111111-1111-4111-8111-111111111111'::uuid, '22222222-2222-4222-8222-222222222222'::uuid, ARRAY[(p0 + interval '3 months')::date], 'mp-old-test', '33333333-3333-4333-8333-333333333333'::uuid) INTO b3;
  PERFORM public.record_approved_due_payment_batch(b3, 'mp-old-payment', now());
  SELECT batch_id, transaction_id INTO b4, tx
  FROM public.record_manual_due_payment_batch('11111111-1111-4111-8111-111111111111'::uuid, '22222222-2222-4222-8222-222222222222'::uuid, ARRAY[(p0 + interval '4 months')::date], 'other', '33333333-3333-4333-8333-333333333333'::uuid);
  IF (SELECT payment_source FROM public.due_payment_batches WHERE id=b4) <> 'manual' THEN
    RAISE EXCEPTION 'a new manual period was blocked by an older Mercado Pago period';
  END IF;

  SELECT public.create_due_payment_batch('11111111-1111-4111-8111-111111111111'::uuid, '22222222-2222-4222-8222-222222222222'::uuid, ARRAY[(p0 + interval '5 months')::date], 'expiry-test', '33333333-3333-4333-8333-333333333333'::uuid) INTO b5;
  claim := public.claim_due_batch_checkout(b5, NULL);
  IF claim->>'attempt' <> '1' THEN RAISE EXCEPTION 'first checkout attempt was not created'; END IF;
  PERFORM public.complete_due_batch_checkout(b5, 1, 'old-pref', 'https://example.invalid/old', now() - interval '1 minute');
  claim := public.claim_due_batch_checkout(b5, 'old-pref');
  IF claim->>'attempt' <> '2' THEN RAISE EXCEPTION 'expired checkout did not recover to a new attempt'; END IF;

  SELECT batch_id, transaction_id INTO b6, tx
  FROM public.record_manual_due_payment_batch('11111111-1111-4111-8111-111111111111'::uuid, '44444444-4444-4444-8444-444444444444'::uuid,
    ARRAY[p0, (p0 + interval '1 month')::date, (p0 + interval '2 months')::date, (p0 + interval '3 months')::date, (p0 + interval '4 months')::date, (p0 + interval '5 months')::date], 'transfer', '33333333-3333-4333-8333-333333333333'::uuid);
  SELECT count(*) INTO new_paid_count FROM public.member_dues WHERE household_id='44444444-4444-4444-8444-444444444444'::uuid AND status='paid' AND payment_source='manual';
  IF new_paid_count <> 6 THEN RAISE EXCEPTION 'new household did not receive six prepaid manual periods'; END IF;

  BEGIN
    PERFORM public.create_due_payment_batch('11111111-1111-4111-8111-111111111111'::uuid, '44444444-4444-4444-8444-444444444444'::uuid,
      ARRAY[(p0 - interval '1 month')::date], 'before-incorporation', '33333333-3333-4333-8333-333333333333'::uuid);
    RAISE EXCEPTION 'a period before incorporation was invented';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'a period before incorporation was invented'
      OR position('anterior a la incorporación' IN SQLERRM) = 0 THEN RAISE; END IF;
  END;

  SELECT public.create_due_payment_batch('11111111-1111-4111-8111-111111111111'::uuid, '22222222-2222-4222-8222-222222222222'::uuid,
    ARRAY[(p0 + interval '6 months')::date], 'active-batch-legacy', '33333333-3333-4333-8333-333333333333'::uuid) INTO b7;
  BEGIN
    PERFORM public.create_due_payment_batch('11111111-1111-4111-8111-111111111111'::uuid, '22222222-2222-4222-8222-222222222222'::uuid,
      ARRAY[(p0 + interval '6 months')::date], 'legacy-concurrent', '33333333-3333-4333-8333-333333333333'::uuid);
    RAISE EXCEPTION 'concurrent legacy checkout bypassed the active batch';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'concurrent legacy checkout bypassed the active batch'
      OR position('cobro en proceso' IN SQLERRM) = 0 THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.reverse_manual_household_dues('11111111-1111-4111-8111-111111111111'::uuid, '22222222-2222-4222-8222-222222222222'::uuid, ARRAY[(p0 + interval '3 months')::date], '33333333-3333-4333-8333-333333333333'::uuid);
    RAISE EXCEPTION 'Mercado Pago period was manually reversed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'Mercado Pago period was manually reversed'
      OR position('requiere reembolso' IN SQLERRM) = 0 THEN RAISE; END IF;
  END;
END $$;

SELECT 'due payment PostgreSQL integration checks passed' AS result;
RESET ROLE;

-- Dashboard aggregate regressions. These run in the same disposable database
-- when DUE_TEST_DATABASE_URL and psql are available.
INSERT INTO public.juntas (id, name, slug, region, invite_code, subscription_status)
VALUES ('55555555-5555-4555-8555-555555555555'::uuid, 'Junta Aislada Dos', 'due-test-junta-dos', 'Metropolitana', 'DUE555', 'authorized')
ON CONFLICT (id) DO NOTHING;

-- 1,205 movements using the accounting rules enforced by the trigger:
-- manual rows carry no provider fee, Mercado Pago rows carry their real fee,
-- transfers are excluded from operating balance, and refunds are expenses.
INSERT INTO public.transactions(junta_id, type, description, amount, date, created_by, source, accounting_kind, category, gross_amount, fee_amount, net_amount)
SELECT '11111111-1111-4111-8111-111111111111'::uuid, 'ingreso', 'aggregate-fixture-' || i, 1000, date '2024-01-01' + (i % 365), '33333333-3333-4333-8333-333333333333'::uuid, 'manual', 'income', 'cuota_social', 1000, 0, 1000
FROM generate_series(1, 1167) AS fixture(i);
INSERT INTO public.transactions(junta_id, type, description, amount, date, created_by, source, accounting_kind, category, gross_amount, fee_amount, net_amount, provider, provider_transaction_id, account_code)
SELECT '11111111-1111-4111-8111-111111111111'::uuid, 'ingreso', 'mp-income-fixture-' || i, 5000, date '2024-01-01' + i, '33333333-3333-4333-8333-333333333333'::uuid, 'mercadopago', 'income', 'cuota_social', 5000, 180, 4820, 'mercadopago', 'aggregate-mp-' || i, 'mercadopago'
FROM generate_series(1, 10) AS fixture(i);
INSERT INTO public.transactions(junta_id, type, description, amount, date, created_by, source, accounting_kind, category, gross_amount, fee_amount, net_amount)
SELECT '11111111-1111-4111-8111-111111111111'::uuid, 'egreso', 'expense-fixture-' || i, 2500, date '2024-01-01' + i, '33333333-3333-4333-8333-333333333333'::uuid, 'manual', 'expense', 'otros', 2500, 0, -2500
FROM generate_series(1, 20) AS fixture(i);
INSERT INTO public.transactions(junta_id, type, description, amount, date, created_by, source, accounting_kind, category, gross_amount, fee_amount, net_amount, account_code, destination_account_code)
SELECT '11111111-1111-4111-8111-111111111111'::uuid, 'egreso', 'transfer-fixture-' || i, 1000, date '2024-01-01' + i, '33333333-3333-4333-8333-333333333333'::uuid, 'bank_import', 'transfer', 'traspaso', 1000, 0, -1000, 'bank', 'cash'
FROM generate_series(1, 5) AS fixture(i);
INSERT INTO public.transactions(junta_id, type, description, amount, date, created_by, source, accounting_kind, category, gross_amount, fee_amount, net_amount, provider, provider_transaction_id, account_code)
SELECT '11111111-1111-4111-8111-111111111111'::uuid, 'egreso', 'refund-fixture-' || i, 5000, date '2024-01-01' + i, '33333333-3333-4333-8333-333333333333'::uuid, 'mercadopago', 'expense', 'reembolso', 5000, 0, -5000, 'mercadopago', 'aggregate-refund-' || i, 'mercadopago'
FROM generate_series(1, 3) AS fixture(i);
INSERT INTO public.transactions(junta_id, type, description, amount, date, created_by, source, accounting_kind, category, gross_amount, fee_amount, net_amount)
VALUES ('55555555-5555-4555-8555-555555555555'::uuid, 'ingreso', 'other-junta-fixture', 5000, date '2024-03-01', NULL, 'manual', 'income', 'cuota_social', 5000, 0, 5000);

INSERT INTO public.member_dues (junta_id, profile_id, household_id, period, amount, status, payment_source)
VALUES (:'junta_id', :'neighbor_a_id', :'neighbor_household_id', date_trunc('month', CURRENT_DATE)::date, 10000, 'paid', 'manual')
ON CONFLICT (household_id, period) WHERE household_id IS NOT NULL DO NOTHING;
INSERT INTO public.member_dues (junta_id, profile_id, household_id, period, amount, status, payment_source)
SELECT :'junta_id', :'neighbor_a_id', :'neighbor_household_id', (date '1900-01-01' + ((fixture.i - 1) || ' months')::interval)::date, 10000, 'paid', 'manual'
FROM generate_series(1, 1205) AS fixture(i)
ON CONFLICT (household_id, period) WHERE household_id IS NOT NULL DO NOTHING;

INSERT INTO public.website_pages(junta_id, template, published, content, theme, gallery)
VALUES ('11111111-1111-4111-8111-111111111111'::uuid, 'comunidad', true, '{"public":"v1"}'::jsonb, '{"primary":"#000000"}'::jsonb, '[]'::jsonb)
ON CONFLICT (junta_id) DO NOTHING;
UPDATE public.website_pages
SET published = true, content = '{"public":"v1"}'::jsonb, draft_content = '{"public":"draft"}'::jsonb
WHERE junta_id = '11111111-1111-4111-8111-111111111111'::uuid;

RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'actor_id', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
DO $$
DECLARE
  total_movements bigint;
  total_income numeric;
  total_expenses numeric;
  total_fees numeric;
  total_balance numeric;
  roster_count bigint;
  public_snapshot jsonb;
BEGIN
  SELECT COALESCE(sum(movement_count), 0), COALESCE(sum(income), 0), COALESCE(sum(expenses), 0), COALESCE(sum(fees), 0), COALESCE(sum(balance), 0)
  INTO total_movements, total_income, total_expenses, total_fees, total_balance
  FROM public.treasury_monthly_summary('11111111-1111-4111-8111-111111111111'::uuid, '2024-01-01', '2024-12-31', NULL, NULL);
  IF total_movements <> 1205 OR total_income <> 1217000 OR total_expenses <> 66800 OR total_fees <> 1800 OR total_balance <> 1150200 THEN
    RAISE EXCEPTION 'monthly aggregate mismatch: %, %, %, %, %', total_movements, total_income, total_expenses, total_fees, total_balance;
  END IF;
  IF (SELECT amount FROM public.treasury_expense_breakdown('11111111-1111-4111-8111-111111111111'::uuid, '2024-01-01', '2024-12-31', NULL, NULL) WHERE category = 'comisiones') <> 1800 THEN
    RAISE EXCEPTION 'expense breakdown did not include all commissions';
  END IF;
  IF (SELECT balance FROM public.treasury_summary('55555555-5555-4555-8555-555555555555'::uuid, '2024-01-01', '2024-12-31', NULL, NULL)) <> 0 THEN
    RAISE EXCEPTION 'tenant boundary leaked another junta transaction';
  END IF;
  SELECT count(*) INTO roster_count FROM public.junta_roster_page(date_trunc('month', CURRENT_DATE)::date, NULL, NULL, NULL, NULL, 0, 50);
  IF roster_count < 1 THEN RAISE EXCEPTION 'roster page did not return the active member'; END IF;
  public_snapshot := public.get_public_website('due-test-junta');
  IF public_snapshot->'content'->>'public' <> 'v1' OR public_snapshot->'content'->>'public' = 'draft' THEN
    RAISE EXCEPTION 'public website exposed the draft snapshot';
  END IF;
  IF has_table_privilege('anon', 'public.website_pages', 'SELECT') THEN
    RAISE EXCEPTION 'anon can read website_pages directly';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.treasury_monthly_summary(uuid,date,date,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated role cannot execute monthly summary';
  END IF;
END $$;

-- Authorization checks use actual database roles, JWT claims and direct RPC
-- calls. SET ROLE is required; changing only request.jwt.claim.role while a
-- superuser is connected would bypass the privileges under test.
RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'neighbor_a_id', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
DO $$
DECLARE roster_count bigint; own_history bigint; cross_history bigint; history_total bigint;
BEGIN
  SELECT count(*) INTO roster_count FROM public.junta_roster_page(date_trunc('month', CURRENT_DATE)::date, NULL, NULL, NULL, NULL, 0, 50);
  IF roster_count <> 0 THEN RAISE EXCEPTION 'neighbor enumerated roster PII'; END IF;
  SELECT count(*), max(total_count) INTO own_history, history_total FROM public.junta_due_history(ARRAY['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid], 0, 200);
  SELECT count(*) INTO cross_history FROM public.junta_due_history(ARRAY['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, '22222222-2222-4222-8222-222222222222'::uuid], 0, 200);
  IF own_history <> 200 OR cross_history <> own_history OR history_total <> 1206 THEN RAISE EXCEPTION 'neighbor read another household due history or history pagination is unbounded'; END IF;
END $$;

RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'dirigente_b_id', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
DO $$
DECLARE roster_count bigint;
BEGIN
  SELECT count(*) INTO roster_count FROM public.junta_roster_page(date_trunc('month', CURRENT_DATE)::date, NULL, NULL, NULL, NULL, 0, 50);
  IF roster_count <> 1 THEN RAISE EXCEPTION 'dirigente B crossed junta boundary or lost roster access'; END IF;
  IF (SELECT count(*) FROM public.junta_due_history(ARRAY['22222222-2222-4222-8222-222222222222'::uuid, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid], 0, 200)) <> 0 THEN
    RAISE EXCEPTION 'dirigente B read another junta due history';
  END IF;
END $$;

RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'inactive_neighbor_a_id', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
DO $$
BEGIN
  IF (SELECT count(*) FROM public.junta_roster_page(date_trunc('month', CURRENT_DATE)::date, NULL, NULL, NULL, NULL, 0, 50)) <> 0 THEN
    RAISE EXCEPTION 'inactive neighbor accessed roster';
  END IF;
  IF (SELECT count(*) FROM public.junta_due_history(ARRAY['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid], 0, 200)) <> 0 THEN
    RAISE EXCEPTION 'inactive neighbor accessed due history';
  END IF;
END $$;

RESET ROLE;
SET ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT set_config('request.jwt.claim.role', 'anon', false);
DO $$
BEGIN
  BEGIN PERFORM count(*) FROM public.junta_roster_page(date_trunc('month', CURRENT_DATE)::date, NULL, NULL, NULL, NULL, 0, 50); RAISE EXCEPTION 'anon roster RPC was executable'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM count(*) FROM public.junta_due_history(ARRAY['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid], 0, 200); RAISE EXCEPTION 'anon history RPC was executable'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;

RESET ROLE;
SET ROLE service_role;
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT set_config('request.jwt.claim.role', 'service_role', false);
DO $$
BEGIN
  BEGIN PERFORM count(*) FROM public.junta_roster_page(date_trunc('month', CURRENT_DATE)::date, NULL, NULL, NULL, NULL, 0, 50); RAISE EXCEPTION 'service_role roster RPC was executable'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM count(*) FROM public.junta_due_history(ARRAY['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid], 0, 200); RAISE EXCEPTION 'service_role history RPC was executable'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;

RESET ROLE;

SELECT 'roster and due history role isolation checks passed' AS result;
SELECT 'dashboard aggregate PostgreSQL integration checks passed' AS result;
