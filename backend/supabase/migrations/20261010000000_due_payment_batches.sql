-- Multi-period household dues.
-- A batch is the provider charge and the batch items are the periods it covers.
-- Legacy member_dues rows remain valid; batch dues use payment_batch_id and one
-- transaction on the batch, so a Mercado Pago id is never copied to each period.

CREATE TABLE IF NOT EXISTS public.due_payment_batches (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  junta_id UUID NOT NULL REFERENCES public.juntas(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE RESTRICT,
  request_key TEXT NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount > 0),
  currency TEXT NOT NULL DEFAULT 'CLP' CHECK (currency = 'CLP'),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'preference_created', 'approved', 'rejected', 'refunded')),
  mercadopago_preference_id TEXT,
  mercadopago_payment_id TEXT,
  checkout_url TEXT,
  checkout_expires_at TIMESTAMPTZ,
  checkout_attempt INTEGER NOT NULL DEFAULT 0 CHECK (checkout_attempt >= 0),
  transaction_id BIGINT UNIQUE REFERENCES public.transactions(id) ON DELETE SET NULL,
  refund_transaction_id BIGINT UNIQUE REFERENCES public.transactions(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (junta_id, household_id, request_key)
);

CREATE TABLE IF NOT EXISTS public.due_payment_batch_items (
  batch_id UUID NOT NULL REFERENCES public.due_payment_batches(id) ON DELETE CASCADE,
  due_id UUID NOT NULL REFERENCES public.member_dues(id) ON DELETE RESTRICT,
  period DATE NOT NULL CHECK (extract(day FROM period) = 1),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  PRIMARY KEY (batch_id, due_id),
  UNIQUE (batch_id, period)
);

ALTER TABLE public.member_dues
  ADD COLUMN IF NOT EXISTS payment_batch_id UUID REFERENCES public.due_payment_batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS checkout_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS checkout_attempt INTEGER NOT NULL DEFAULT 0 CHECK (checkout_attempt >= 0);

CREATE TABLE IF NOT EXISTS public.member_due_payment_attempts (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  due_id UUID NOT NULL REFERENCES public.member_dues(id) ON DELETE CASCADE,
  payment_batch_id UUID REFERENCES public.due_payment_batches(id) ON DELETE SET NULL,
  provider_payment_id TEXT,
  provider_preference_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('refunded', 'replaced', 'rejected', 'cancelled')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_due_payment_batches_household_status
  ON public.due_payment_batches(junta_id, household_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_due_payment_batch_items_due
  ON public.due_payment_batch_items(due_id);
CREATE INDEX IF NOT EXISTS idx_member_dues_payment_batch
  ON public.member_dues(payment_batch_id) WHERE payment_batch_id IS NOT NULL;

ALTER TABLE public.due_payment_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.due_payment_batch_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_due_payment_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Households can read own due payment batches" ON public.due_payment_batches;
CREATE POLICY "Households can read own due payment batches"
ON public.due_payment_batches FOR SELECT TO authenticated
USING (
  junta_id = public.current_junta_id()
  AND (household_id = (SELECT household_id FROM public.profiles WHERE id = auth.uid())
       OR public.current_user_role() = 'dirigente')
);

DROP POLICY IF EXISTS "Households can read own due payment batch items" ON public.due_payment_batch_items;
CREATE POLICY "Households can read own due payment batch items"
ON public.due_payment_batch_items FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.due_payment_batches batch
  WHERE batch.id = batch_id
    AND batch.junta_id = public.current_junta_id()
    AND (batch.household_id = (SELECT household_id FROM public.profiles WHERE id = auth.uid())
         OR public.current_user_role() = 'dirigente')
));

GRANT SELECT ON public.due_payment_batches, public.due_payment_batch_items TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.due_payment_batches, public.due_payment_batch_items TO service_role;
GRANT SELECT, INSERT ON public.member_due_payment_attempts TO service_role;

CREATE OR REPLACE FUNCTION public.create_due_payment_batch(
  p_junta_id UUID,
  p_household_id UUID,
  p_periods DATE[],
  p_request_key TEXT,
  p_created_by UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  normalized_periods DATE[];
  target_batch UUID;
  target_due public.member_dues%ROWTYPE;
  dwelling public.households%ROWTYPE;
  monthly_amount INTEGER;
  total NUMERIC(12,2) := 0;
  current_period DATE;
  open_batch UUID;
BEGIN
  IF p_request_key IS NULL OR char_length(trim(p_request_key)) < 8 THEN
    RAISE EXCEPTION 'La solicitud de cobro no tiene una clave válida';
  END IF;
  SELECT array_agg(period ORDER BY period) INTO normalized_periods
  FROM (SELECT DISTINCT date_trunc('month', period)::date AS period FROM unnest(p_periods) AS input(period)) periods;
  IF normalized_periods IS NULL OR cardinality(normalized_periods) < 1 OR cardinality(normalized_periods) > 12 THEN
    RAISE EXCEPTION 'Selecciona entre uno y doce períodos';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(normalized_periods) period WHERE period > (timezone('America/Santiago', now())::date + INTERVAL '12 months')::date) THEN
    RAISE EXCEPTION 'No puedes pagar períodos tan lejanos';
  END IF;

  SELECT * INTO dwelling FROM public.households WHERE id = p_household_id AND junta_id = p_junta_id FOR UPDATE;
  IF dwelling.id IS NULL THEN RAISE EXCEPTION 'Domicilio no encontrado'; END IF;
  SELECT monthly_due_amount INTO monthly_amount FROM public.juntas WHERE id = p_junta_id;
  IF monthly_amount IS NULL THEN RAISE EXCEPTION 'Junta no encontrada'; END IF;

  SELECT id INTO target_batch FROM public.due_payment_batches
  WHERE junta_id = p_junta_id AND household_id = p_household_id AND request_key = p_request_key;
  IF target_batch IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.due_payment_batches WHERE id = target_batch AND status IN ('pending', 'preference_created', 'approved')) THEN
      RETURN target_batch;
    END IF;
    -- A rejected or refunded attempt can be retried with the same idempotency key.
    -- Keep its transaction history and reopen only the provider attempt.
    INSERT INTO public.member_due_payment_attempts(due_id, payment_batch_id, provider_payment_id, provider_preference_id, status, amount)
    SELECT due.id, target_batch, due.mercadopago_payment_id, due.mercadopago_preference_id,
      CASE WHEN due.status = 'refunded' THEN 'refunded' ELSE 'rejected' END, due.amount
    FROM public.member_dues due WHERE due.payment_batch_id = target_batch AND due.status IN ('refunded', 'rejected');
    UPDATE public.member_dues SET status = 'pending', mercadopago_payment_id = NULL,
      mercadopago_preference_id = NULL, checkout_url = NULL, checkout_expires_at = NULL,
      paid_at = NULL, refund_transaction_id = NULL, updated_at = timezone('utc'::text, now())
    WHERE payment_batch_id = target_batch AND status IN ('refunded', 'rejected');
    UPDATE public.due_payment_batches SET status = 'pending', mercadopago_payment_id = NULL,
      mercadopago_preference_id = NULL, checkout_url = NULL, checkout_expires_at = NULL,
      transaction_id = NULL, refund_transaction_id = NULL, confirmed_at = NULL,
      updated_at = timezone('utc'::text, now()) WHERE id = target_batch;
    RETURN target_batch;
  END IF;

  -- Serialize requests for the same household. This closes the manual-vs-provider
  -- race before any external preference is created.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_junta_id::text || ':' || p_household_id::text, 0));

  FOREACH current_period IN ARRAY normalized_periods LOOP
    SELECT * INTO target_due FROM public.member_dues
    WHERE household_id = p_household_id AND period = current_period
    FOR UPDATE;
    IF target_due.status = 'paid' THEN
      RAISE EXCEPTION 'El período % ya está pagado', to_char(current_period, 'MM/YYYY');
    END IF;
    IF target_due.status = 'refunded' THEN
      INSERT INTO public.member_due_payment_attempts(
        due_id, provider_payment_id, provider_preference_id, status, amount
      ) VALUES (
        target_due.id, target_due.mercadopago_payment_id, target_due.mercadopago_preference_id,
        'replaced', target_due.amount
      );
      UPDATE public.member_dues SET
        status = 'pending', mercadopago_payment_id = NULL, mercadopago_preference_id = NULL,
        checkout_url = NULL, checkout_expires_at = NULL, payment_batch_id = NULL,
        refund_transaction_id = NULL, paid_at = NULL, updated_at = timezone('utc'::text, now())
      WHERE id = target_due.id;
    END IF;
    SELECT batch.id INTO open_batch
    FROM public.due_payment_batch_items item
    JOIN public.due_payment_batches batch ON batch.id = item.batch_id
    WHERE item.due_id = target_due.id AND batch.status IN ('pending', 'preference_created')
    LIMIT 1;
    IF open_batch IS NOT NULL THEN
      RAISE EXCEPTION 'Ya existe un cobro en proceso para uno de los períodos seleccionados';
    END IF;
    total := total + coalesce(target_due.amount, monthly_amount);
  END LOOP;

  INSERT INTO public.due_payment_batches(
    junta_id, household_id, request_key, total_amount, created_by
  ) VALUES (p_junta_id, p_household_id, p_request_key, total, p_created_by)
  RETURNING id INTO target_batch;

  FOREACH current_period IN ARRAY normalized_periods LOOP
    SELECT * INTO target_due FROM public.member_dues
    WHERE household_id = p_household_id AND period = current_period FOR UPDATE;
    IF target_due.id IS NULL THEN
      INSERT INTO public.member_dues(
        junta_id, household_id, profile_id, period, amount, status
      ) VALUES (
        p_junta_id, p_household_id,
        (SELECT id FROM public.profiles WHERE household_id = p_household_id ORDER BY created_at LIMIT 1),
        current_period, monthly_amount, 'pending'
      ) RETURNING * INTO target_due;
    END IF;
    INSERT INTO public.due_payment_batch_items(batch_id, due_id, period, amount)
    VALUES (target_batch, target_due.id, current_period, coalesce(target_due.amount, monthly_amount));
    UPDATE public.member_dues SET payment_batch_id = target_batch, updated_at = timezone('utc'::text, now()) WHERE id = target_due.id;
  END LOOP;
  RETURN target_batch;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_approved_due_payment_batch(
  p_batch_id UUID,
  p_payment_id TEXT,
  p_paid_at TIMESTAMPTZ
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  batch public.due_payment_batches%ROWTYPE;
  item RECORD;
  dwelling public.households%ROWTYPE;
  tx_id BIGINT;
  expected_total NUMERIC(12,2);
BEGIN
  SELECT * INTO batch FROM public.due_payment_batches WHERE id = p_batch_id FOR UPDATE;
  IF batch.id IS NULL THEN RAISE EXCEPTION 'Lote de cuotas no encontrado'; END IF;
  IF batch.status = 'approved' THEN
    IF batch.mercadopago_payment_id IS DISTINCT FROM p_payment_id THEN RAISE EXCEPTION 'El lote ya fue confirmado con otro pago'; END IF;
    RETURN batch.transaction_id;
  END IF;
  IF batch.status IN ('refunded', 'rejected') THEN RAISE EXCEPTION 'El lote no admite confirmación'; END IF;
  SELECT coalesce(sum(amount), 0) INTO expected_total FROM public.due_payment_batch_items WHERE batch_id = batch.id;
  IF expected_total <> batch.total_amount THEN RAISE EXCEPTION 'El total del lote no coincide con sus períodos'; END IF;
  SELECT * INTO dwelling FROM public.households WHERE id = batch.household_id AND junta_id = batch.junta_id;
  IF dwelling.id IS NULL THEN RAISE EXCEPTION 'Domicilio del lote no encontrado'; END IF;

  FOR item IN SELECT * FROM public.due_payment_batch_items WHERE batch_id = batch.id ORDER BY period LOOP
    PERFORM 1 FROM public.member_dues WHERE id = item.due_id FOR UPDATE;
    IF EXISTS (SELECT 1 FROM public.member_dues WHERE id = item.due_id AND status = 'paid' AND payment_batch_id IS DISTINCT FROM batch.id) THEN
      RAISE EXCEPTION 'Uno de los períodos ya fue pagado';
    END IF;
  END LOOP;

  INSERT INTO public.transactions(
    junta_id, type, description, amount, date, created_by, source, accounting_kind,
    account_code, category, gross_amount, fee_amount, net_amount, provider,
    provider_transaction_id, provider_event_key, external_reference,
    verification_status, verified_at, is_immutable
  ) VALUES (
    batch.junta_id, 'ingreso', 'Cuotas domiciliarias ' || to_char((SELECT min(period) FROM public.due_payment_batch_items WHERE batch_id = batch.id), 'MM/YYYY') ||
      ' a ' || to_char((SELECT max(period) FROM public.due_payment_batch_items WHERE batch_id = batch.id), 'MM/YYYY') || ' — Mercado Pago',
    batch.total_amount, coalesce(p_paid_at::date, timezone('America/Santiago', now())::date), batch.created_by,
    'mercadopago', 'income', 'mercadopago', 'cuota_social', batch.total_amount, 0, batch.total_amount,
    'mercadopago', p_payment_id, 'due-batch:' || p_payment_id,
    'juntapp-due-batch:' || batch.id || ':' || batch.junta_id || ':' || batch.household_id,
    'provider_confirmed', coalesce(p_paid_at, timezone('utc'::text, now())), true
  ) RETURNING id INTO tx_id;

  UPDATE public.member_dues SET
    status = 'paid', payment_source = 'mercadopago', manual_payment_method = NULL,
    mercadopago_payment_id = NULL, paid_at = p_paid_at, transaction_id = NULL,
    payment_batch_id = batch.id, updated_at = timezone('utc'::text, now())
  WHERE payment_batch_id = batch.id;
  UPDATE public.profiles SET cuota_status = 'al_dia' WHERE household_id = batch.household_id AND junta_id = batch.junta_id;
  UPDATE public.due_payment_batches SET status = 'approved', mercadopago_payment_id = p_payment_id,
    transaction_id = tx_id, confirmed_at = coalesce(p_paid_at, timezone('utc'::text, now())), updated_at = timezone('utc'::text, now())
  WHERE id = batch.id;
  INSERT INTO public.notifications(user_id, type, title, message, read, date, action)
  SELECT id, 'cuota', 'Cuotas del domicilio recibidas',
    'Mercado Pago confirmó ' || (SELECT count(*) FROM public.due_payment_batch_items WHERE batch_id = batch.id) || ' períodos de tu domicilio.',
    false, timezone('utc'::text, now()), '/tesoreria'
  FROM public.profiles WHERE household_id = batch.household_id AND junta_id = batch.junta_id;
  RETURN tx_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_refunded_due_payment_batch(p_batch_id UUID, p_payment_id TEXT)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE batch public.due_payment_batches%ROWTYPE; transaction_id BIGINT;
BEGIN
  SELECT * INTO batch FROM public.due_payment_batches WHERE id = p_batch_id FOR UPDATE;
  IF batch.id IS NULL OR batch.mercadopago_payment_id IS DISTINCT FROM p_payment_id THEN RAISE EXCEPTION 'Lote de pago no encontrado'; END IF;
  IF batch.status = 'refunded' THEN RETURN batch.refund_transaction_id; END IF;
  INSERT INTO public.transactions(
    junta_id, type, description, amount, date, created_by, source, accounting_kind,
    account_code, category, gross_amount, fee_amount, net_amount, provider,
    provider_transaction_id, provider_event_key, external_reference,
    verification_status, verified_at, is_immutable
  ) VALUES (
    batch.junta_id, 'egreso', 'Reembolso de lote de cuotas domiciliarias', batch.total_amount,
    timezone('America/Santiago', now())::date, batch.created_by, 'mercadopago', 'expense',
    'mercadopago', 'reembolso_cuota', batch.total_amount, 0, -batch.total_amount, 'mercadopago',
    p_payment_id, 'due-batch-refund:' || p_payment_id,
    'juntapp-due-batch:' || batch.id || ':' || batch.junta_id || ':' || batch.household_id,
    'provider_confirmed', timezone('utc'::text, now()), true
  ) RETURNING id INTO transaction_id;
  UPDATE public.member_dues SET status = 'refunded', paid_at = NULL, updated_at = timezone('utc'::text, now()) WHERE payment_batch_id = batch.id;
  UPDATE public.due_payment_batches SET status = 'refunded', refund_transaction_id = transaction_id, updated_at = timezone('utc'::text, now()) WHERE id = batch.id;
  UPDATE public.profiles SET cuota_status = 'pendiente' WHERE household_id = batch.household_id AND junta_id = batch.junta_id;
  RETURN transaction_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_manual_due_payment_batch(
  p_junta_id UUID, p_household_id UUID, p_periods DATE[], p_method TEXT, p_actor UUID
)
RETURNS TABLE(batch_id UUID, transaction_id BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE batch public.due_payment_batches%ROWTYPE; item RECORD; tx BIGINT;
BEGIN
  IF p_method NOT IN ('cash', 'transfer', 'other') THEN RAISE EXCEPTION 'Medio de pago manual inválido'; END IF;
  batch.id := public.create_due_payment_batch(
    p_junta_id, p_household_id, p_periods,
    'manual:' || md5(p_household_id::text || ':' || array_to_string(p_periods, ',')), p_actor
  );
  SELECT * INTO batch FROM public.due_payment_batches WHERE id = batch.id FOR UPDATE;
  IF batch.status = 'approved' THEN RETURN QUERY SELECT batch.id, batch.transaction_id; RETURN; END IF;
  INSERT INTO public.transactions(junta_id, type, description, amount, date, created_by, source, accounting_kind, account_code, category, gross_amount, fee_amount, net_amount, verification_status, is_immutable)
  VALUES(p_junta_id, 'ingreso', 'Pago manual de cuotas domiciliarias (' || p_method || ')', batch.total_amount, timezone('America/Santiago', now())::date, p_actor, 'manual', 'income', 'cash', 'cuota_social', batch.total_amount, 0, batch.total_amount, 'manual', false)
  RETURNING id INTO tx;
  UPDATE public.member_dues SET status = 'paid', payment_source = 'manual', manual_payment_method = p_method, paid_at = timezone('utc'::text, now()), transaction_id = NULL, payment_batch_id = batch.id, updated_at = timezone('utc'::text, now()) WHERE payment_batch_id = batch.id;
  UPDATE public.due_payment_batches SET status = 'approved', transaction_id = tx, confirmed_at = timezone('utc'::text, now()), updated_at = timezone('utc'::text, now()) WHERE id = batch.id;
  UPDATE public.profiles SET cuota_status = 'al_dia' WHERE household_id = p_household_id AND junta_id = p_junta_id;
  RETURN QUERY SELECT batch.id, tx;
END;
$$;

REVOKE ALL ON FUNCTION public.create_due_payment_batch(UUID, UUID, DATE[], TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_approved_due_payment_batch(UUID, TEXT, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_refunded_due_payment_batch(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_manual_due_payment_batch(UUID, UUID, DATE[], TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_due_payment_batch(UUID, UUID, DATE[], TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_approved_due_payment_batch(UUID, TEXT, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_refunded_due_payment_batch(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_manual_due_payment_batch(UUID, UUID, DATE[], TEXT, UUID) TO service_role;

-- Close the legacy manual-vs-provider race. A manually paid due has no provider
-- payment id, so an approved Mercado Pago callback must never be treated as a
-- harmless duplicate of that manual payment.
CREATE OR REPLACE FUNCTION public.record_approved_member_due(p_due_id UUID, p_payment_id TEXT, p_paid_at TIMESTAMPTZ)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE target_due public.member_dues%ROWTYPE; payer_id UUID; tx_id BIGINT;
BEGIN
  SELECT * INTO target_due FROM public.member_dues WHERE id = p_due_id FOR UPDATE;
  IF target_due.id IS NULL THEN RAISE EXCEPTION 'Cuota no encontrada'; END IF;
  IF target_due.status = 'paid' THEN
    IF target_due.payment_source IS DISTINCT FROM 'mercadopago' OR target_due.mercadopago_payment_id IS DISTINCT FROM p_payment_id THEN
      RAISE EXCEPTION 'La cuota ya fue pagada por otro medio';
    END IF;
    RETURN target_due.transaction_id;
  END IF;
  IF target_due.status IN ('refunded', 'rejected') AND target_due.mercadopago_payment_id IS NOT NULL AND target_due.mercadopago_payment_id IS DISTINCT FROM p_payment_id THEN
    RAISE EXCEPTION 'La cuota tiene otra referencia de proveedor';
  END IF;
  IF target_due.household_id IS NOT NULL THEN
    SELECT id INTO payer_id FROM public.profiles WHERE household_id = target_due.household_id ORDER BY (id = target_due.profile_id) DESC, created_at LIMIT 1;
  ELSE
    SELECT id INTO payer_id FROM public.profiles WHERE id = target_due.profile_id;
  END IF;
  INSERT INTO public.transactions(
    junta_id, type, description, amount, date, created_by, source, accounting_kind,
    account_code, category, gross_amount, fee_amount, net_amount, provider,
    provider_transaction_id, provider_event_key, external_reference,
    verification_status, verified_at, is_immutable
  ) VALUES (
    target_due.junta_id, 'ingreso', 'Cuota domicilio ' || to_char(target_due.period, 'MM/YYYY') || ' — Mercado Pago', target_due.amount,
    coalesce(p_paid_at::date, timezone('America/Santiago', now())::date), payer_id, 'mercadopago', 'income', 'mercadopago', 'cuota_social',
    target_due.amount, 0, target_due.amount, 'mercadopago', p_payment_id, 'due-payment:' || p_payment_id,
    'juntapp-due:' || target_due.id || ':' || target_due.junta_id || ':' || coalesce(target_due.household_id::text, ''),
    'provider_confirmed', coalesce(p_paid_at, timezone('utc'::text, now())), true
  ) RETURNING id INTO tx_id;
  UPDATE public.member_dues SET status='paid', payment_source='mercadopago', manual_payment_method=NULL,
    mercadopago_payment_id=p_payment_id, paid_at=p_paid_at, transaction_id=tx_id, updated_at=timezone('utc'::text, now())
  WHERE id=target_due.id;
  IF target_due.household_id IS NOT NULL THEN
    UPDATE public.profiles SET cuota_status='al_dia' WHERE household_id=target_due.household_id AND junta_id=target_due.junta_id;
  ELSE
    UPDATE public.profiles SET cuota_status='al_dia' WHERE id=target_due.profile_id AND junta_id=target_due.junta_id;
  END IF;
  RETURN tx_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_approved_member_due(UUID, TEXT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_approved_member_due(UUID, TEXT, TIMESTAMPTZ) TO service_role;

CREATE OR REPLACE FUNCTION public.record_refunded_member_due(p_due_id UUID, p_payment_id TEXT)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE target_due public.member_dues%ROWTYPE; tx_id BIGINT;
BEGIN
  SELECT * INTO target_due FROM public.member_dues WHERE id = p_due_id FOR UPDATE;
  IF target_due.id IS NULL OR target_due.payment_source IS DISTINCT FROM 'mercadopago' OR target_due.mercadopago_payment_id IS DISTINCT FROM p_payment_id THEN
    RAISE EXCEPTION 'Pago de cuota no encontrado';
  END IF;
  IF target_due.status = 'refunded' THEN RETURN target_due.refund_transaction_id; END IF;
  INSERT INTO public.transactions(
    junta_id, type, description, amount, date, created_by, source, accounting_kind,
    account_code, category, gross_amount, fee_amount, net_amount, provider,
    provider_transaction_id, provider_event_key, external_reference,
    verification_status, verified_at, is_immutable
  ) VALUES (
    target_due.junta_id, 'egreso', 'Reembolso cuota domicilio ' || to_char(target_due.period, 'MM/YYYY') || ' — Mercado Pago', target_due.amount,
    timezone('America/Santiago', now())::date, target_due.profile_id, 'mercadopago', 'expense', 'mercadopago', 'reembolso_cuota',
    target_due.amount, 0, -target_due.amount, 'mercadopago', p_payment_id, 'due-refund:' || p_payment_id,
    'juntapp-due:' || target_due.id || ':' || target_due.junta_id || ':' || coalesce(target_due.household_id::text, ''),
    'provider_confirmed', timezone('utc'::text, now()), true
  ) RETURNING id INTO tx_id;
  UPDATE public.member_dues SET status='refunded', refund_transaction_id=tx_id, updated_at=timezone('utc'::text, now()) WHERE id=target_due.id;
  IF target_due.household_id IS NOT NULL THEN
    UPDATE public.profiles SET cuota_status='pendiente' WHERE household_id=target_due.household_id AND junta_id=target_due.junta_id;
  ELSE
    UPDATE public.profiles SET cuota_status='pendiente' WHERE id=target_due.profile_id AND junta_id=target_due.junta_id;
  END IF;
  RETURN tx_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_refunded_member_due(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_refunded_member_due(UUID, TEXT) TO service_role;
