-- Changing a monthly fee applies from the current Chilean month. Earlier debts,
-- paid periods and provider quotes keep their original amounts.
CREATE TABLE public.monthly_due_rates (
  junta_id UUID NOT NULL REFERENCES public.juntas(id) ON DELETE CASCADE,
  effective_from DATE NOT NULL CHECK (extract(day FROM effective_from) = 1),
  amount INTEGER NOT NULL CHECK (amount BETWEEN 500 AND 1000000),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (junta_id, effective_from)
);

-- The baseline records the configured amount before versioned changes begin.
-- Existing member_dues remain authoritative for their recorded periods.
INSERT INTO public.monthly_due_rates(junta_id, effective_from, amount)
SELECT id, DATE '0001-01-01', monthly_due_amount FROM public.juntas;

ALTER TABLE public.monthly_due_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read their junta fee schedule" ON public.monthly_due_rates
  FOR SELECT TO authenticated USING (junta_id = public.current_junta_id() AND public.is_active_member());
GRANT SELECT ON public.monthly_due_rates TO authenticated;
GRANT ALL ON public.monthly_due_rates TO service_role;

CREATE FUNCTION public.due_amount_for_period(p_junta_id UUID, p_period DATE)
RETURNS INTEGER LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(
    (SELECT amount FROM public.monthly_due_rates
      WHERE junta_id = p_junta_id AND effective_from <= p_period
      ORDER BY effective_from DESC LIMIT 1),
    (SELECT monthly_due_amount FROM public.juntas WHERE id = p_junta_id)
  );
$$;
REVOKE ALL ON FUNCTION public.due_amount_for_period(UUID, DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.due_amount_for_period(UUID, DATE) TO service_role;

CREATE FUNCTION public.capture_monthly_due_rate()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE current_period DATE := date_trunc('month', public.current_chile_date())::date;
BEGIN
  -- Batch creation holds the same lock while quoting every selected period.
  PERFORM pg_advisory_xact_lock(hashtextextended('dues-rate:' || NEW.id, 0));
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.monthly_due_rates(junta_id, effective_from, amount)
      VALUES(NEW.id, DATE '0001-01-01', NEW.monthly_due_amount);
    RETURN NEW;
  END IF;
  INSERT INTO public.monthly_due_rates(junta_id, effective_from, amount)
    VALUES(NEW.id, DATE '0001-01-01', OLD.monthly_due_amount)
    ON CONFLICT (junta_id, effective_from) DO NOTHING;
  INSERT INTO public.monthly_due_rates(junta_id, effective_from, amount)
    VALUES(NEW.id, current_period, NEW.monthly_due_amount)
    ON CONFLICT (junta_id, effective_from) DO UPDATE
      SET amount = excluded.amount, updated_at = now();

  -- Re-saving the same configured amount also repairs stale pending rows.
  -- Never change an amount already sent to a provider or attached to a quote.
  UPDATE public.member_dues d
    SET amount = public.due_amount_for_period(NEW.id, d.period), updated_at = now()
    WHERE d.junta_id = NEW.id AND d.period >= current_period
      AND d.status IN ('pending', 'rejected')
      AND d.mercadopago_payment_id IS NULL
      AND d.mercadopago_preference_id IS NULL
      AND d.refund_transaction_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.due_payment_batch_items i
        JOIN public.due_payment_batches b ON b.id = i.batch_id
        WHERE i.due_id = d.id AND b.status IN ('pending', 'preference_created')
      );
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.capture_monthly_due_rate() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER capture_monthly_due_rate_insert AFTER INSERT ON public.juntas
  FOR EACH ROW EXECUTE FUNCTION public.capture_monthly_due_rate();
CREATE TRIGGER capture_monthly_due_rate_update AFTER UPDATE OF monthly_due_amount ON public.juntas
  FOR EACH ROW EXECUTE FUNCTION public.capture_monthly_due_rate();

-- Keep the hardened batch workflow; only the fallback price becomes period-aware.
CREATE OR REPLACE FUNCTION public.create_due_payment_batch(p_junta_id UUID,p_household_id UUID,p_periods DATE[],p_request_key TEXT,p_created_by UUID DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE periods DATE[]; dwelling public.households%ROWTYPE; b public.due_payment_batches%ROWTYPE;
  d public.member_dues%ROWTYPE; pr DATE; total NUMERIC:=0; monthly INTEGER; oldest DATE; new_id UUID;
BEGIN
  IF p_request_key IS NULL OR length(p_request_key)<8 OR EXISTS(SELECT 1 FROM unnest(p_periods) x WHERE x IS NULL OR extract(day FROM x)<>1) THEN
    RAISE EXCEPTION 'Solicitud de períodos inválida'; END IF;
  SELECT array_agg(x ORDER BY x) INTO periods FROM (SELECT DISTINCT unnest(p_periods) x) a;
  IF coalesce(cardinality(periods),0) NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'Selecciona entre uno y doce períodos'; END IF;
  IF periods[cardinality(periods)] > (date_trunc('month',public.current_chile_date())+interval '12 months')::date THEN
    RAISE EXCEPTION 'No puedes pagar períodos tan lejanos'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('dues-rate:'||p_junta_id,0));
  PERFORM pg_advisory_xact_lock(hashtextextended(p_junta_id||':'||p_household_id,0));
  SELECT * INTO dwelling FROM public.households WHERE id=p_household_id AND junta_id=p_junta_id FOR UPDATE;
  IF dwelling.id IS NULL THEN RAISE EXCEPTION 'Domicilio no encontrado'; END IF;

  SELECT date_trunc('month',dwelling.created_at AT TIME ZONE 'America/Santiago')::date INTO oldest;
  -- Existing historical rows are readable/payable, even if household migration
  -- was later than the original member incorporation.
  IF EXISTS(SELECT 1 FROM unnest(periods) x WHERE x<oldest AND NOT EXISTS
    (SELECT 1 FROM public.member_dues WHERE household_id=p_household_id AND period=x)) THEN
    RAISE EXCEPTION 'No se puede crear una cuota anterior a la incorporación del domicilio'; END IF;
  SELECT * INTO b FROM public.due_payment_batches b1 WHERE b1.junta_id=p_junta_id AND b1.household_id=p_household_id
    AND b1.status IN ('pending','preference_created','approved') AND b1.request_key LIKE p_request_key||'%'
    AND (SELECT array_agg(i.period ORDER BY i.period) FROM public.due_payment_batch_items i WHERE i.batch_id=b1.id)=periods
    ORDER BY b1.created_at DESC LIMIT 1;
  IF b.id IS NOT NULL AND (b.status<>'approved' OR NOT EXISTS(SELECT 1 FROM public.due_payment_batch_items i
    JOIN public.member_dues d1 ON d1.id=i.due_id WHERE i.batch_id=b.id AND (d1.payment_batch_id IS DISTINCT FROM b.id OR d1.status<>'paid'))) THEN RETURN b.id; END IF;
  FOREACH pr IN ARRAY periods LOOP
    SELECT * INTO d FROM public.member_dues WHERE household_id=p_household_id AND period=pr FOR UPDATE;
    IF d.status IN ('paid','preference_created')
      OR (d.status='pending' AND (d.mercadopago_payment_id IS NOT NULL OR d.mercadopago_preference_id IS NOT NULL)) THEN
      RAISE EXCEPTION 'El período % está pagado o tiene un cobro externo abierto',pr;
    END IF;
    IF EXISTS(SELECT 1 FROM public.due_payment_batch_items i JOIN public.due_payment_batches b1 ON b1.id=i.batch_id
      WHERE i.due_id=d.id AND b1.status IN ('pending','preference_created')) THEN
      RAISE EXCEPTION 'Ya existe un cobro en proceso para uno de los períodos'; END IF;
    total:=total+coalesce(d.amount,public.due_amount_for_period(p_junta_id,pr));
  END LOOP;
  INSERT INTO public.due_payment_batches(junta_id,household_id,request_key,total_amount,created_by)
    VALUES(p_junta_id,p_household_id,p_request_key||':'||extensions.uuid_generate_v4(),total,p_created_by) RETURNING id INTO new_id;
  FOREACH pr IN ARRAY periods LOOP
    SELECT * INTO d FROM public.member_dues WHERE household_id=p_household_id AND period=pr FOR UPDATE;
    IF d.id IS NULL THEN
      monthly:=public.due_amount_for_period(p_junta_id,pr);
      INSERT INTO public.member_dues(junta_id,household_id,profile_id,period,amount) VALUES(p_junta_id,p_household_id,
        (SELECT id FROM public.profiles WHERE household_id=p_household_id ORDER BY created_at LIMIT 1),pr,monthly) RETURNING * INTO d;
    END IF;
    IF d.mercadopago_payment_id IS NOT NULL THEN
      INSERT INTO public.member_due_payment_attempts(due_id,payment_batch_id,provider_payment_id,provider_preference_id,status,amount)
        VALUES(d.id,d.payment_batch_id,d.mercadopago_payment_id,d.mercadopago_preference_id,'replaced',d.amount);
    END IF;
    INSERT INTO public.due_payment_batch_items VALUES(new_id,d.id,pr,d.amount);
    UPDATE public.member_dues SET payment_batch_id=new_id,status='pending',payment_source=NULL,manual_payment_method=NULL,
      mercadopago_payment_id=NULL,mercadopago_preference_id=NULL,checkout_url=NULL,checkout_expires_at=NULL,
      transaction_id=NULL,refund_transaction_id=NULL,paid_at=NULL,updated_at=now() WHERE id=d.id;
  END LOOP;
  RETURN new_id;
END; $$;

-- Repair already-configured fees when upgrading, with the same quote safeguards.
UPDATE public.juntas SET monthly_due_amount = monthly_due_amount;
