\set ON_ERROR_STOP on
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.member_dues WHERE junta_id='70000000-0000-4000-8000-000000000000'
    AND ((period<date_trunc('month',public.current_chile_date())::date AND amount<>6000)
      OR (period>=date_trunc('month',public.current_chile_date())::date AND amount<>10000))) THEN
    RAISE EXCEPTION 'Migration did not repair configured current dues while preserving history'; END IF;
END $$;
BEGIN;
-- A deterministic Chile-local month makes the 2026/2027 regression reproducible.
CREATE OR REPLACE FUNCTION public.current_chile_date() RETURNS DATE
LANGUAGE sql STABLE AS $$ SELECT DATE '2026-10-14'; $$;
SELECT set_config('request.jwt.claim.role', 'service_role', true);
ALTER TABLE auth.users DISABLE TRIGGER USER;
INSERT INTO auth.users(id,email,raw_user_meta_data,raw_app_meta_data,aud,role,created_at,updated_at)
VALUES
('61111111-1111-4111-8111-111111111111','rates-president@example.invalid','{}','{}','authenticated','authenticated',now(),now()),
('62222222-2222-4222-8222-222222222222','rates-paid@example.invalid','{}','{}','authenticated','authenticated',now(),now()),
('63333333-3333-4333-8333-333333333333','rates-quote@example.invalid','{}','{}','authenticated','authenticated',now(),now()),
('64444444-4444-4444-8444-444444444444','rates-legacy@example.invalid','{}','{}','authenticated','authenticated',now(),now());
ALTER TABLE auth.users ENABLE TRIGGER USER;
INSERT INTO public.juntas(id,name,slug,region,invite_code,monthly_due_amount,subscription_status)
VALUES('60000000-0000-4000-8000-000000000000','Prueba vigencia cuotas','rates-test','Metropolitana','RATE26',10000,'authorized');
INSERT INTO public.households(id,junta_id,address,normalized_address,created_at)
SELECT id,'60000000-0000-4000-8000-000000000000',address,lower(address),'2026-05-01 15:00:00+00' FROM (VALUES
('65111111-1111-4111-8111-111111111111'::uuid,'Calle Cuotas 1'),
('65222222-2222-4222-8222-222222222222'::uuid,'Calle Cuotas 2'),
('65333333-3333-4333-8333-333333333333'::uuid,'Calle Cuotas 3'),
('65444444-4444-4444-8444-444444444444'::uuid,'Calle Cuotas 4')) h(id,address);
INSERT INTO public.profiles(id,name,rut,address,email,role,junta_id,household_id,membership_status,board_position)
SELECT id,'Prueba cuotas',rut,address,email,role,'60000000-0000-4000-8000-000000000000',household,'active',position
FROM (VALUES
('61111111-1111-4111-8111-111111111111'::uuid,'99.111.111-1','Calle Cuotas 1','rates-president@example.invalid','dirigente','65111111-1111-4111-8111-111111111111'::uuid,'presidente'),
('62222222-2222-4222-8222-222222222222'::uuid,'99.222.222-2','Calle Cuotas 2','rates-paid@example.invalid','vecino','65222222-2222-4222-8222-222222222222'::uuid,NULL),
('63333333-3333-4333-8333-333333333333'::uuid,'99.333.333-3','Calle Cuotas 3','rates-quote@example.invalid','vecino','65333333-3333-4333-8333-333333333333'::uuid,NULL),
('64444444-4444-4444-8444-444444444444'::uuid,'99.444.444-4','Calle Cuotas 4','rates-legacy@example.invalid','vecino','65444444-4444-4444-8444-444444444444'::uuid,NULL)
) p(id,rut,address,email,role,household,position);
INSERT INTO public.member_dues(junta_id,household_id,profile_id,period,amount,status,mercadopago_preference_id)
VALUES
('60000000-0000-4000-8000-000000000000','65111111-1111-4111-8111-111111111111','61111111-1111-4111-8111-111111111111','2026-09-01',6000,'pending',NULL),
('60000000-0000-4000-8000-000000000000','65111111-1111-4111-8111-111111111111','61111111-1111-4111-8111-111111111111','2026-10-01',5000,'pending',NULL),
('60000000-0000-4000-8000-000000000000','65111111-1111-4111-8111-111111111111','61111111-1111-4111-8111-111111111111','2027-01-01',5000,'pending',NULL),
('60000000-0000-4000-8000-000000000000','65222222-2222-4222-8222-222222222222','62222222-2222-4222-8222-222222222222','2026-10-01',10000,'paid',NULL),
('60000000-0000-4000-8000-000000000000','65333333-3333-4333-8333-333333333333','63333333-3333-4333-8333-333333333333','2026-10-01',5000,'pending',NULL),
('60000000-0000-4000-8000-000000000000','65444444-4444-4444-8444-444444444444','64444444-4444-4444-8444-444444444444','2026-10-01',10000,'preference_created','rates-legacy-preference');
SELECT public.create_due_payment_batch('60000000-0000-4000-8000-000000000000','65333333-3333-4333-8333-333333333333',ARRAY[DATE '2026-10-01'],'rate-quote-test','61111111-1111-4111-8111-111111111111');

-- Exercise the same authenticated UPDATE as /api/dues/settings, including RLS.
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT SELECT ON public.profiles TO authenticated;
SELECT set_config('request.jwt.claim.sub','61111111-1111-4111-8111-111111111111',true);
SELECT set_config('request.jwt.claim.role','authenticated',true);
SET LOCAL ROLE authenticated;
UPDATE public.juntas SET monthly_due_amount=10000 WHERE id='60000000-0000-4000-8000-000000000000';
RESET ROLE;
DO $$ BEGIN
  IF (SELECT amount FROM public.member_dues WHERE household_id='65111111-1111-4111-8111-111111111111' AND period='2026-10-01')<>10000 THEN
    RAISE EXCEPTION 'Re-saving the configured amount did not repair the current month'; END IF;
END $$;
SET LOCAL ROLE authenticated;
UPDATE public.juntas SET monthly_due_amount=8000 WHERE id='60000000-0000-4000-8000-000000000000';
RESET ROLE;
SELECT set_config('request.jwt.claim.role','service_role',true);
DO $$
DECLARE result RECORD; bid UUID; current_amount INTEGER; historic_amount INTEGER;
BEGIN
  SELECT amount INTO current_amount FROM public.member_dues WHERE household_id='65111111-1111-4111-8111-111111111111' AND period='2026-10-01';
  SELECT amount INTO historic_amount FROM public.member_dues WHERE household_id='65111111-1111-4111-8111-111111111111' AND period='2026-09-01';
  IF current_amount<>8000 OR historic_amount<>6000 THEN RAISE EXCEPTION 'Current or historical amount incorrect'; END IF;
  IF (SELECT amount FROM public.member_dues WHERE household_id='65111111-1111-4111-8111-111111111111' AND period='2027-01-01')<>8000 THEN RAISE EXCEPTION 'Unpaid future month was not updated'; END IF;
  IF public.due_amount_for_period('60000000-0000-4000-8000-000000000000','2026-08-01')<>10000 THEN RAISE EXCEPTION 'Unrecorded historical month was repriced'; END IF;
  IF public.due_amount_for_period('60000000-0000-4000-8000-000000000000','2027-02-01')<>8000 THEN RAISE EXCEPTION 'Future rate is incorrect'; END IF;
  IF (SELECT amount FROM public.member_dues WHERE household_id='65222222-2222-4222-8222-222222222222')<>10000 THEN RAISE EXCEPTION 'Paid current month was changed'; END IF;
  IF (SELECT amount FROM public.member_dues WHERE household_id='65333333-3333-4333-8333-333333333333')<>5000 THEN RAISE EXCEPTION 'Batch quote was changed'; END IF;
  IF (SELECT total_amount FROM public.due_payment_batches WHERE household_id='65333333-3333-4333-8333-333333333333')<>5000 THEN RAISE EXCEPTION 'Provider batch total was changed'; END IF;
  IF (SELECT amount FROM public.member_dues WHERE household_id='65444444-4444-4444-8444-444444444444')<>10000 THEN RAISE EXCEPTION 'Legacy provider quote was changed'; END IF;

  SELECT * INTO result FROM public.record_manual_due_payment_batch('60000000-0000-4000-8000-000000000000','65111111-1111-4111-8111-111111111111',ARRAY[DATE '2026-09-01',DATE '2026-10-01',DATE '2027-01-01'],'cash','61111111-1111-4111-8111-111111111111');
  IF (SELECT total_amount FROM public.due_payment_batches WHERE id=result.batch_id)<>22000
    OR (SELECT amount FROM public.transactions WHERE id=result.transaction_id)<>22000 THEN RAISE EXCEPTION 'Mixed-period payment total incorrect'; END IF;
  -- A new unrecorded past period must use its old rate in both total and item.
  bid:=public.create_due_payment_batch('60000000-0000-4000-8000-000000000000','65111111-1111-4111-8111-111111111111',ARRAY[DATE '2026-08-01'],'historical-rate-test','61111111-1111-4111-8111-111111111111');
  IF (SELECT total_amount FROM public.due_payment_batches WHERE id=bid)<>10000
    OR (SELECT amount FROM public.due_payment_batch_items WHERE batch_id=bid)<>10000 THEN RAISE EXCEPTION 'Historical checkout does not match its original rate'; END IF;
  -- Reconfiguration cannot rewrite amounts already paid in advance for 2027.
  UPDATE public.juntas SET monthly_due_amount=9000 WHERE id='60000000-0000-4000-8000-000000000000';
  IF (SELECT amount FROM public.member_dues WHERE household_id='65111111-1111-4111-8111-111111111111' AND period='2027-01-01')<>8000 THEN RAISE EXCEPTION 'Advance payment was repriced'; END IF;
END $$;

-- Direct schedule writes are unavailable to neighbors, even within their junta.
SELECT set_config('request.jwt.claim.sub','62222222-2222-4222-8222-222222222222',true);
SELECT set_config('request.jwt.claim.role','authenticated',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    INSERT INTO public.monthly_due_rates(junta_id,effective_from,amount) VALUES('60000000-0000-4000-8000-000000000000','2027-01-01',500);
    RAISE EXCEPTION 'Neighbor changed the fee schedule';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'due rate effective-period regression checks passed' AS result;
