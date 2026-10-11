\set ON_ERROR_STOP on
\set junta_id '11111111-1111-4111-8111-111111111111'
\set household_id '22222222-2222-4222-8222-222222222222'
\set actor_id '33333333-3333-4333-8333-333333333333'
\set new_household_id '44444444-4444-4444-8444-444444444444'

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
VALUES (:'new_household_id', :'junta_id', 'Pasaje Nuevo 456', 'pasaje nuevo 456', date_trunc('month', public.current_chile_date()) + interval '14 days')
ON CONFLICT (id) DO NOTHING;
UPDATE public.profiles
SET junta_id=:'junta_id', household_id=:'household_id', role='dirigente', board_position='tesorero', membership_status='active', name='Due Test', rut='99.999.991-1', address='Pasaje Prueba 123', email='due-test@example.invalid'
WHERE id=:'actor_id';

SELECT set_config('request.jwt.claim.sub', :'actor_id', false);
SELECT set_config('request.jwt.claim.role', 'service_role', false);

DO $$
DECLARE
  p0 date := date_trunc('month', public.current_chile_date())::date;
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
