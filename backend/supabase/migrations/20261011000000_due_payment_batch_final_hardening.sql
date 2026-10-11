-- Incremental correction of the published batch schema. Never reopen a closed
-- batch: its items, receipt, income and reversal remain an audit record.
ALTER TABLE public.due_payment_batches DROP CONSTRAINT due_payment_batches_status_check;
ALTER TABLE public.due_payment_batches ADD CONSTRAINT due_payment_batches_status_check
  CHECK (status IN ('pending','preference_created','approved','rejected','refunded','reversed'));
ALTER TABLE public.due_payment_batches
  ADD COLUMN payment_source TEXT CHECK (payment_source IN ('manual','mercadopago')),
  ADD COLUMN manual_payment_method TEXT CHECK (manual_payment_method IN ('cash','transfer','other')),
  ADD COLUMN reversal_transaction_id BIGINT UNIQUE REFERENCES public.transactions(id),
  ADD COLUMN reversed_at TIMESTAMPTZ,
  ADD COLUMN reversed_by UUID REFERENCES public.profiles(id);
UPDATE public.due_payment_batches b SET payment_source=t.source,
  manual_payment_method=(SELECT d.manual_payment_method FROM public.member_dues d WHERE d.payment_batch_id=b.id LIMIT 1)
  FROM public.transactions t WHERE t.id=b.transaction_id;

CREATE TABLE public.due_payment_batch_attempts (
  batch_id UUID NOT NULL REFERENCES public.due_payment_batches(id),
  attempt INTEGER NOT NULL CHECK (attempt > 0),
  preference_id TEXT UNIQUE,
  checkout_url TEXT,
  status TEXT NOT NULL CHECK (status IN ('creating','active','resolved')),
  expires_at TIMESTAMPTZ,
  lease_until TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  PRIMARY KEY (batch_id,attempt)
);
INSERT INTO public.due_payment_batch_attempts(batch_id,attempt,preference_id,checkout_url,status,expires_at,lease_until)
  SELECT id,greatest(checkout_attempt,1),mercadopago_preference_id,checkout_url,
    CASE WHEN checkout_url IS NULL THEN 'creating' ELSE 'active' END,checkout_expires_at,now()
  FROM public.due_payment_batches WHERE status='preference_created';
UPDATE public.due_payment_batches SET checkout_attempt=1 WHERE status='preference_created' AND checkout_attempt=0;

-- Logical identity shared by report import and webhook. Adjustments have their
-- own event identity; they are not collapsed into the payment or full refund.
ALTER TABLE public.transactions ADD COLUMN provider_operation_type TEXT;
UPDATE public.transactions SET provider_operation_type=CASE
  WHEN accounting_kind='income' THEN 'payment'
  WHEN category IN ('reembolso_cuota','reembolso') THEN 'refund'
  ELSE 'event:' || coalesce(provider_event_key,id::text) END
  WHERE provider='mercadopago' AND provider_transaction_id IS NOT NULL;
-- Deliberately fail on pre-existing ambiguous duplicates instead of deleting
-- financial history. The deployment preflight must resolve those separately.
CREATE UNIQUE INDEX transactions_provider_operation_unique ON public.transactions
  (junta_id,provider,provider_transaction_id,provider_operation_type)
  WHERE provider_operation_type IS NOT NULL;

CREATE TABLE public.due_provider_receipts (
  junta_id UUID NOT NULL REFERENCES public.juntas(id),
  provider_payment_id TEXT NOT NULL,
  household_id UUID REFERENCES public.households(id),
  batch_id UUID REFERENCES public.due_payment_batches(id),
  due_id UUID REFERENCES public.member_dues(id),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  state TEXT NOT NULL CHECK (state IN ('applied','unapplied','refunded')),
  transaction_id BIGINT NOT NULL UNIQUE REFERENCES public.transactions(id),
  refund_transaction_id BIGINT UNIQUE REFERENCES public.transactions(id),
  paid_at TIMESTAMPTZ NOT NULL,
  reason TEXT,
  PRIMARY KEY (junta_id,provider_payment_id),
  CHECK (num_nonnulls(batch_id,due_id)=1)
);
INSERT INTO public.due_provider_receipts
  SELECT junta_id,mercadopago_payment_id,household_id,id,NULL,total_amount,
    CASE WHEN status='refunded' THEN 'refunded' ELSE 'applied' END,transaction_id,refund_transaction_id,
    coalesce(confirmed_at,created_at),NULL
  FROM public.due_payment_batches WHERE mercadopago_payment_id IS NOT NULL AND transaction_id IS NOT NULL;
INSERT INTO public.due_provider_receipts
  SELECT junta_id,mercadopago_payment_id,household_id,NULL,id,amount,
    CASE WHEN status='refunded' THEN 'refunded' ELSE 'applied' END,transaction_id,refund_transaction_id,
    coalesce(paid_at,created_at),NULL
  FROM public.member_dues WHERE mercadopago_payment_id IS NOT NULL AND transaction_id IS NOT NULL;

ALTER TABLE public.due_provider_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.due_payment_batch_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own provider receipts" ON public.due_provider_receipts FOR SELECT TO authenticated
  USING (junta_id=public.current_junta_id() AND
    (household_id=(SELECT household_id FROM public.profiles WHERE id=auth.uid()) OR public.current_user_role()='dirigente'));
GRANT SELECT ON public.due_provider_receipts TO authenticated;
REVOKE ALL ON public.due_payment_batch_attempts FROM anon,authenticated;
GRANT ALL ON public.due_provider_receipts,public.due_payment_batch_attempts TO service_role;

-- The same advisory lock is used for webhook and report, so check + insert +
-- link is independent of arrival order. Reconciliation never gets downgraded.
CREATE FUNCTION public.upsert_mercadopago_operation(p_values JSONB)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE tx public.transactions%ROWTYPE; j UUID:=(p_values->>'junta_id')::uuid;
  op TEXT:=p_values->>'provider_operation_type'; pid TEXT:=p_values->>'provider_transaction_id';
BEGIN
  IF op IS NULL OR pid IS NULL THEN RAISE EXCEPTION 'Falta identidad de operación'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('mp:'||j||':'||pid||':'||op,0));
  SELECT * INTO tx FROM public.transactions WHERE junta_id=j AND provider='mercadopago'
    AND provider_transaction_id=pid AND provider_operation_type=op FOR UPDATE;
  IF tx.id IS NOT NULL THEN
    IF tx.gross_amount<>(p_values->>'gross_amount')::numeric THEN RAISE EXCEPTION 'Importe de operación no coincide'; END IF;
    IF p_values->>'verification_status'='reconciled' THEN
      UPDATE public.transactions SET fee_amount=(p_values->>'fee_amount')::numeric,
        net_amount=(p_values->>'net_amount')::numeric,verification_status='reconciled',verified_at=now()
        WHERE id=tx.id;
    END IF;
    RETURN tx.id;
  END IF;
  INSERT INTO public.transactions(junta_id,type,description,amount,date,created_by,source,accounting_kind,
    account_code,destination_account_code,category,gross_amount,fee_amount,net_amount,provider,
    provider_transaction_id,provider_operation_type,provider_event_key,external_reference,verification_status,verified_at,is_immutable)
  VALUES(j,p_values->>'type',p_values->>'description',(p_values->>'gross_amount')::numeric,
    coalesce((p_values->>'date')::date,public.current_chile_date()),(p_values->>'created_by')::uuid,'mercadopago',
    p_values->>'accounting_kind','mercadopago',p_values->>'destination_account_code',p_values->>'category',
    (p_values->>'gross_amount')::numeric,coalesce((p_values->>'fee_amount')::numeric,0),
    (p_values->>'net_amount')::numeric,'mercadopago',pid,op,p_values->>'provider_event_key',
    p_values->>'external_reference',p_values->>'verification_status',now(),true) RETURNING * INTO tx;
  RETURN tx.id;
END; $$;

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
  PERFORM pg_advisory_xact_lock(hashtextextended(p_junta_id||':'||p_household_id,0));
  SELECT * INTO dwelling FROM public.households WHERE id=p_household_id AND junta_id=p_junta_id FOR UPDATE;
  IF dwelling.id IS NULL THEN RAISE EXCEPTION 'Domicilio no encontrado'; END IF;
  SELECT monthly_due_amount INTO monthly FROM public.juntas WHERE id=p_junta_id;
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
    total:=total+coalesce(d.amount,monthly);
  END LOOP;
  INSERT INTO public.due_payment_batches(junta_id,household_id,request_key,total_amount,created_by)
    VALUES(p_junta_id,p_household_id,p_request_key||':'||extensions.uuid_generate_v4(),total,p_created_by) RETURNING id INTO new_id;
  FOREACH pr IN ARRAY periods LOOP
    SELECT * INTO d FROM public.member_dues WHERE household_id=p_household_id AND period=pr FOR UPDATE;
    IF d.id IS NULL THEN
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

CREATE FUNCTION public.claim_due_batch_checkout(p_batch_id UUID,p_resolved_preference_id TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.due_payment_batches%ROWTYPE; a public.due_payment_batch_attempts%ROWTYPE;
BEGIN
  SELECT * INTO b FROM public.due_payment_batches WHERE id=p_batch_id FOR UPDATE;
  IF b.id IS NULL OR b.status NOT IN ('pending','preference_created') THEN RAISE EXCEPTION 'El lote no admite checkout'; END IF;
  SELECT * INTO a FROM public.due_payment_batch_attempts WHERE batch_id=b.id AND attempt=b.checkout_attempt FOR UPDATE;
  IF a.status='active' AND a.expires_at>now() THEN RETURN jsonb_build_object('ready',true,'attempt',a.attempt,'checkout_url',a.checkout_url); END IF;
  IF a.status='active' THEN
    IF a.preference_id IS DISTINCT FROM p_resolved_preference_id OR p_resolved_preference_id IS NULL THEN
      RAISE EXCEPTION 'Resuelve la preferencia anterior con el proveedor antes de renovar'; END IF;
    UPDATE public.due_payment_batch_attempts SET status='resolved',resolved_at=now() WHERE batch_id=b.id AND attempt=a.attempt;
  ELSIF a.status='creating' THEN
    IF a.lease_until>now() THEN RAISE EXCEPTION 'Otro intento está preparando este cobro'; END IF;
    -- An uncertain provider call is retried with the SAME idempotency key.
    UPDATE public.due_payment_batch_attempts SET lease_until=now()+interval '60 seconds' WHERE batch_id=b.id AND attempt=a.attempt;
    RETURN jsonb_build_object('ready',false,'attempt',a.attempt);
  END IF;
  UPDATE public.due_payment_batches SET status='preference_created',checkout_attempt=checkout_attempt+1,
    checkout_url=NULL,checkout_expires_at=NULL,updated_at=now() WHERE id=b.id RETURNING * INTO b;
  INSERT INTO public.due_payment_batch_attempts(batch_id,attempt,status,lease_until)
    VALUES(b.id,b.checkout_attempt,'creating',now()+interval '60 seconds');
  RETURN jsonb_build_object('ready',false,'attempt',b.checkout_attempt);
END; $$;

CREATE FUNCTION public.complete_due_batch_checkout(p_batch_id UUID,p_attempt INTEGER,p_preference_id TEXT,p_url TEXT,p_expires_at TIMESTAMPTZ)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.due_payment_batches%ROWTYPE;
BEGIN
  SELECT * INTO b FROM public.due_payment_batches WHERE id=p_batch_id FOR UPDATE;
  IF b.checkout_attempt<>p_attempt OR b.status<>'preference_created' THEN RAISE EXCEPTION 'El intento fue reemplazado o confirmado'; END IF;
  UPDATE public.due_payment_batch_attempts SET status='active',preference_id=p_preference_id,checkout_url=p_url,expires_at=p_expires_at
    WHERE batch_id=b.id AND attempt=p_attempt AND status='creating';
  IF NOT FOUND THEN RAISE EXCEPTION 'Intento no encontrado'; END IF;
  UPDATE public.due_payment_batches SET mercadopago_preference_id=p_preference_id,checkout_url=p_url,
    checkout_expires_at=p_expires_at,updated_at=now() WHERE id=b.id;
END; $$;

CREATE FUNCTION public.refresh_household_due_status(p_household_id UUID)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  UPDATE public.profiles SET cuota_status=CASE WHEN EXISTS(SELECT 1 FROM public.member_dues d WHERE d.household_id=p_household_id
    AND d.period=date_trunc('month',public.current_chile_date())::date AND d.status='paid') THEN 'al_dia' ELSE 'pendiente' END
    WHERE household_id=p_household_id;
$$;

-- A receipt is recorded even when an obsolete checkout received real money.
-- Such funds are unapplied and require a provider refund; periods stay covered
-- by their original operation. Duplicates return the existing receipt.
CREATE FUNCTION public.record_due_provider_receipt(p_batch_id UUID,p_due_id UUID,p_payment_id TEXT,p_paid_at TIMESTAMPTZ,p_refund BOOLEAN DEFAULT false)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.due_payment_batches%ROWTYPE; d public.member_dues%ROWTYPE; r public.due_provider_receipts%ROWTYPE;
  j UUID; h UUID; amount NUMERIC; actor UUID; tx BIGINT; applied BOOLEAN; vals JSONB;
BEGIN
  IF p_payment_id IS NULL OR p_payment_id='' OR num_nonnulls(p_batch_id,p_due_id)<>1 THEN RAISE EXCEPTION 'Referencia inválida'; END IF;
  IF p_batch_id IS NOT NULL THEN SELECT * INTO b FROM public.due_payment_batches WHERE id=p_batch_id; j:=b.junta_id; h:=b.household_id; amount:=b.total_amount; actor:=b.created_by;
  ELSE SELECT * INTO d FROM public.member_dues WHERE id=p_due_id; j:=d.junta_id; h:=d.household_id; amount:=d.amount; actor:=d.profile_id; END IF;
  IF j IS NULL THEN RAISE EXCEPTION 'Cuota o lote no encontrado'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(j||':'||coalesce(h,p_due_id),0));
  IF p_batch_id IS NOT NULL THEN SELECT * INTO b FROM public.due_payment_batches WHERE id=p_batch_id FOR UPDATE;
    PERFORM 1 FROM public.member_dues d1 JOIN public.due_payment_batch_items i ON i.due_id=d1.id WHERE i.batch_id=b.id ORDER BY d1.period FOR UPDATE OF d1;
  ELSE SELECT * INTO d FROM public.member_dues WHERE id=p_due_id FOR UPDATE; END IF;
  SELECT * INTO r FROM public.due_provider_receipts WHERE junta_id=j AND provider_payment_id=p_payment_id FOR UPDATE;
  IF r.provider_payment_id IS NOT NULL AND (r.batch_id IS DISTINCT FROM p_batch_id OR r.due_id IS DISTINCT FROM p_due_id) THEN RAISE EXCEPTION 'Pago vinculado a otra operación'; END IF;
  IF r.provider_payment_id IS NOT NULL AND NOT p_refund THEN RETURN r.transaction_id; END IF;
  IF p_refund AND r.state='refunded' THEN RETURN r.refund_transaction_id; END IF;
  vals:=jsonb_build_object('junta_id',j,'created_by',actor,'gross_amount',amount,'fee_amount',0,'provider_transaction_id',p_payment_id,
    'external_reference',CASE WHEN p_batch_id IS NOT NULL THEN 'juntapp-due-batch:'||b.id||':'||j||':'||h ELSE 'juntapp-due:'||d.id||':'||j||':'||coalesce(h::text,'') END,
    'date',coalesce(p_paid_at,now())::date,'verification_status','provider_confirmed');
  IF r.provider_payment_id IS NULL THEN
    applied:=NOT p_refund;
    IF p_batch_id IS NOT NULL THEN
      applied:=applied AND b.status IN ('pending','preference_created','rejected') AND b.payment_source IS DISTINCT FROM 'manual'
        AND NOT EXISTS(SELECT 1 FROM public.due_payment_batch_items i JOIN public.member_dues d1 ON d1.id=i.due_id
          WHERE i.batch_id=b.id AND (d1.status='paid' OR d1.payment_batch_id IS DISTINCT FROM b.id));
    ELSE
      applied:=applied AND d.status<>'paid' AND d.payment_batch_id IS NULL AND d.status<>'refunded';
    END IF;
    tx:=public.upsert_mercadopago_operation(vals||jsonb_build_object('type','ingreso','description',CASE WHEN applied THEN 'Cuotas domiciliarias — Mercado Pago' ELSE 'Pago recibido sin aplicar a cuotas; requiere reembolso' END,
      'accounting_kind','income','category',CASE WHEN applied THEN 'cuota_social' ELSE 'cuota_excedente' END,'net_amount',amount,'provider_operation_type','payment'));
    INSERT INTO public.due_provider_receipts VALUES(j,p_payment_id,h,p_batch_id,p_due_id,amount,
      CASE WHEN applied THEN 'applied' ELSE 'unapplied' END,tx,NULL,coalesce(p_paid_at,now()),CASE WHEN applied THEN NULL ELSE 'Cuotas cubiertas u operación reemplazada' END) RETURNING * INTO r;
    IF applied THEN
      IF p_batch_id IS NOT NULL THEN
        UPDATE public.member_dues SET status='paid',payment_source='mercadopago',manual_payment_method=NULL,paid_at=coalesce(p_paid_at,now()),updated_at=now()
          WHERE payment_batch_id=b.id;
        UPDATE public.due_payment_batches SET status='approved',payment_source='mercadopago',mercadopago_payment_id=p_payment_id,
          transaction_id=tx,confirmed_at=coalesce(p_paid_at,now()),updated_at=now() WHERE id=b.id;
      ELSE
        UPDATE public.member_dues SET status='paid',payment_source='mercadopago',manual_payment_method=NULL,mercadopago_payment_id=p_payment_id,
          transaction_id=tx,paid_at=coalesce(p_paid_at,now()),updated_at=now() WHERE id=d.id;
      END IF;
    ELSE
      INSERT INTO public.notifications(user_id,type,title,message,read,date,action)
        SELECT id,'cuota','Pago adicional pendiente de reembolso','Se recibió un pago adicional. La tesorería debe tramitar su devolución con Mercado Pago.',false,now(),'/tesoreria'
          FROM public.profiles WHERE junta_id=j AND (household_id=h OR role='dirigente');
    END IF;
  END IF;
  IF p_refund THEN
    tx:=public.upsert_mercadopago_operation(vals||jsonb_build_object('type','egreso','description','Reembolso de cuotas — Mercado Pago',
      'accounting_kind','expense','category','reembolso_cuota','net_amount',-amount,'provider_operation_type','refund'));
    IF r.state='applied' THEN
      IF p_batch_id IS NOT NULL THEN
        UPDATE public.member_dues SET status='refunded',paid_at=NULL,updated_at=now() WHERE payment_batch_id=b.id;
        UPDATE public.due_payment_batches SET status='refunded',refund_transaction_id=tx,updated_at=now() WHERE id=b.id;
      ELSE UPDATE public.member_dues SET status='refunded',paid_at=NULL,refund_transaction_id=tx,updated_at=now()
        WHERE id=d.id AND mercadopago_payment_id=p_payment_id; END IF;
    END IF;
    UPDATE public.due_provider_receipts SET state='refunded',refund_transaction_id=tx WHERE junta_id=j AND provider_payment_id=p_payment_id;
  ELSE tx:=r.transaction_id; END IF;
  PERFORM public.refresh_household_due_status(h);
  RETURN tx;
END; $$;
CREATE OR REPLACE FUNCTION public.record_approved_due_payment_batch(p_batch_id UUID,p_payment_id TEXT,p_paid_at TIMESTAMPTZ)
RETURNS BIGINT LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT public.record_due_provider_receipt(p_batch_id,NULL,p_payment_id,p_paid_at,false); $$;
CREATE OR REPLACE FUNCTION public.record_refunded_due_payment_batch(p_batch_id UUID,p_payment_id TEXT)
RETURNS BIGINT LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT public.record_due_provider_receipt(p_batch_id,NULL,p_payment_id,now(),true); $$;
CREATE OR REPLACE FUNCTION public.record_approved_member_due(p_due_id UUID,p_payment_id TEXT,p_paid_at TIMESTAMPTZ)
RETURNS BIGINT LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT public.record_due_provider_receipt(NULL,p_due_id,p_payment_id,p_paid_at,false); $$;
CREATE OR REPLACE FUNCTION public.record_refunded_member_due(p_due_id UUID,p_payment_id TEXT)
RETURNS BIGINT LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT public.record_due_provider_receipt(NULL,p_due_id,p_payment_id,now(),true); $$;

CREATE FUNCTION public.assert_due_manual_actor(p_junta_id UUID,p_actor UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_actor AND junta_id=p_junta_id AND role='dirigente' AND membership_status='active') THEN
    RAISE EXCEPTION 'Solo una directiva activa de la junta puede registrar o revertir pagos'; END IF;
END; $$;
CREATE OR REPLACE FUNCTION public.prepare_manual_treasury_transaction()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
  IF NEW.source='manual' THEN
    NEW.accounting_kind:=CASE NEW.type WHEN 'ingreso' THEN 'income' ELSE 'expense' END;
    NEW.account_code:=coalesce(NEW.account_code,'cash'); NEW.gross_amount:=NEW.amount; NEW.fee_amount:=0;
    NEW.net_amount:=CASE NEW.type WHEN 'ingreso' THEN NEW.amount ELSE -NEW.amount END; NEW.verification_status:='manual';
    -- RPC batch movements set immutable=true. Ordinary cash-book entries remain editable.
  END IF; RETURN NEW;
END; $$;
UPDATE public.transactions SET is_immutable=true WHERE id IN (SELECT transaction_id FROM public.due_payment_batches WHERE payment_source='manual');

CREATE OR REPLACE FUNCTION public.record_manual_due_payment_batch(p_junta_id UUID,p_household_id UUID,p_periods DATE[],p_method TEXT,p_actor UUID)
RETURNS TABLE(batch_id UUID,transaction_id BIGINT) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.due_payment_batches%ROWTYPE; bid UUID; tx BIGINT; periods DATE[];
BEGIN
  PERFORM public.assert_due_manual_actor(p_junta_id,p_actor);
  IF p_method IS NULL OR p_method NOT IN ('cash','transfer','other') THEN RAISE EXCEPTION 'Medio de pago manual inválido'; END IF;
  SELECT array_agg(x ORDER BY x) INTO periods FROM (SELECT DISTINCT unnest(p_periods) x) a;
  bid:=public.create_due_payment_batch(p_junta_id,p_household_id,periods,'manual:'||md5(p_household_id||':'||array_to_string(periods,',')),p_actor);
  SELECT * INTO b FROM public.due_payment_batches WHERE id=bid FOR UPDATE;
  IF b.status='approved' AND b.payment_source='manual' THEN RETURN QUERY SELECT b.id,b.transaction_id; RETURN; END IF;
  IF b.status<>'pending' OR b.mercadopago_preference_id IS NOT NULL THEN RAISE EXCEPTION 'El lote tiene una operación externa abierta'; END IF;
  INSERT INTO public.transactions(junta_id,type,description,amount,date,created_by,account_code,category,is_immutable)
    VALUES(p_junta_id,'ingreso','Pago manual de cuotas ('||p_method||')',b.total_amount,public.current_chile_date(),p_actor,
      CASE WHEN p_method='transfer' THEN 'bank' ELSE 'cash' END,'cuota_social',true) RETURNING id INTO tx;
  UPDATE public.member_dues SET status='paid',payment_source='manual',manual_payment_method=p_method,paid_at=now(),updated_at=now() WHERE payment_batch_id=b.id;
  UPDATE public.due_payment_batches SET status='approved',payment_source='manual',manual_payment_method=p_method,transaction_id=tx,confirmed_at=now(),updated_at=now() WHERE id=b.id;
  PERFORM public.refresh_household_due_status(p_household_id);
  RETURN QUERY SELECT b.id,tx;
END; $$;

CREATE FUNCTION public.reverse_manual_household_dues(p_junta_id UUID,p_household_id UUID,p_periods DATE[],p_actor UUID)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.due_payment_batches%ROWTYPE; d public.member_dues%ROWTYPE; tx BIGINT; last_tx BIGINT; periods DATE[];
BEGIN
  PERFORM public.assert_due_manual_actor(p_junta_id,p_actor);
  SELECT array_agg(x ORDER BY x) INTO periods FROM (SELECT DISTINCT unnest(p_periods) x) a;
  IF coalesce(cardinality(periods),0) NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'Selecciona entre uno y doce períodos'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_junta_id||':'||p_household_id,0));
  PERFORM 1 FROM public.households WHERE id=p_household_id AND junta_id=p_junta_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Domicilio no encontrado'; END IF;
  FOR d IN SELECT * FROM public.member_dues WHERE junta_id=p_junta_id AND household_id=p_household_id AND period=ANY(periods) ORDER BY period FOR UPDATE LOOP
    IF d.status='preference_created'
      OR (d.status='pending' AND (d.mercadopago_payment_id IS NOT NULL OR d.mercadopago_preference_id IS NOT NULL))
      OR EXISTS(SELECT 1 FROM public.due_payment_batches b1 WHERE b1.id=d.payment_batch_id AND b1.status IN ('pending','preference_created')) THEN
      RAISE EXCEPTION 'Existe una operación externa abierta'; END IF;
    IF d.status='paid' AND d.payment_source IS DISTINCT FROM 'manual' THEN RAISE EXCEPTION 'Un pago externo requiere reembolso del proveedor'; END IF;
    IF d.status='paid' AND d.payment_batch_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.due_payment_batch_items i
      WHERE i.batch_id=d.payment_batch_id AND NOT(i.period=ANY(periods))) THEN RAISE EXCEPTION 'Selecciona todos los períodos del lote manual'; END IF;
  END LOOP;
  FOR b IN SELECT * FROM public.due_payment_batches b1 WHERE b1.junta_id=p_junta_id AND b1.household_id=p_household_id
    AND b1.status='approved' AND b1.payment_source='manual' AND b1.id IN(SELECT payment_batch_id FROM public.member_dues
      WHERE household_id=p_household_id AND period=ANY(periods) AND status='paid') ORDER BY b1.id FOR UPDATE LOOP
    INSERT INTO public.transactions(junta_id,type,description,amount,date,created_by,account_code,category,is_immutable)
      VALUES(p_junta_id,'egreso','Reversa de lote manual '||b.id,b.total_amount,public.current_chile_date(),p_actor,
        CASE WHEN b.manual_payment_method='transfer' THEN 'bank' ELSE 'cash' END,'reversa_cuota_manual',true) RETURNING id INTO tx;
    UPDATE public.due_payment_batches SET status='reversed',reversal_transaction_id=tx,reversed_at=now(),reversed_by=p_actor,updated_at=now() WHERE id=b.id;
    UPDATE public.member_dues SET status='pending',paid_at=NULL,payment_source=NULL,manual_payment_method=NULL,updated_at=now() WHERE payment_batch_id=b.id;
    last_tx:=tx;
  END LOOP;
  FOR d IN SELECT * FROM public.member_dues WHERE junta_id=p_junta_id AND household_id=p_household_id AND period=ANY(periods)
    AND status='paid' AND payment_source='manual' AND payment_batch_id IS NULL ORDER BY period FOR UPDATE LOOP
    INSERT INTO public.transactions(junta_id,type,description,amount,date,created_by,category,is_immutable)
      VALUES(p_junta_id,'egreso','Reversa cuota manual '||d.period,d.amount,public.current_chile_date(),p_actor,'reversa_cuota_manual',true) RETURNING id INTO tx;
    INSERT INTO public.member_due_payment_attempts(due_id,status,amount) VALUES(d.id,'cancelled',d.amount);
    UPDATE public.member_dues SET status='pending',paid_at=NULL,payment_source=NULL,manual_payment_method=NULL,refund_transaction_id=tx,updated_at=now() WHERE id=d.id;
    last_tx:=tx;
  END LOOP;
  PERFORM public.refresh_household_due_status(p_household_id); RETURN last_tx;
END; $$;
-- Compatibility wrapper uses exactly the same SQL guards, including pending batches.
CREATE OR REPLACE FUNCTION public.set_manual_household_due(p_household_id UUID,p_junta_id UUID,p_action TEXT,p_method TEXT DEFAULT NULL)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor UUID; result BIGINT;
BEGIN
  actor:=auth.uid();
  IF actor IS NULL AND auth.role()='service_role' THEN
    SELECT id INTO actor FROM public.profiles
      WHERE junta_id=p_junta_id AND role='dirigente' AND membership_status='active'
      ORDER BY CASE board_position WHEN 'tesorero' THEN 0 WHEN 'presidente' THEN 1 ELSE 2 END, created_at
      LIMIT 1;
  END IF;
  IF actor IS NULL THEN RAISE EXCEPTION 'Usa la RPC multi-período con un actor explícito'; END IF;
  IF p_action='pending' THEN RETURN public.reverse_manual_household_dues(p_junta_id,p_household_id,ARRAY[date_trunc('month',public.current_chile_date())::date],actor); END IF;
  IF p_action<>'paid' THEN RAISE EXCEPTION 'Acción inválida'; END IF;
  SELECT transaction_id INTO result FROM public.record_manual_due_payment_batch(p_junta_id,p_household_id,ARRAY[date_trunc('month',public.current_chile_date())::date],p_method,actor);
  RETURN result;
END; $$;

-- Restrict every new SECURITY DEFINER helper. Existing RPC grants are retained.
REVOKE ALL ON FUNCTION public.upsert_mercadopago_operation(JSONB),public.claim_due_batch_checkout(UUID,TEXT),
  public.complete_due_batch_checkout(UUID,INTEGER,TEXT,TEXT,TIMESTAMPTZ),public.refresh_household_due_status(UUID),
  public.record_due_provider_receipt(UUID,UUID,TEXT,TIMESTAMPTZ,BOOLEAN),public.assert_due_manual_actor(UUID,UUID),
  public.reverse_manual_household_dues(UUID,UUID,DATE[],UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_mercadopago_operation(JSONB),public.claim_due_batch_checkout(UUID,TEXT),
  public.complete_due_batch_checkout(UUID,INTEGER,TEXT,TEXT,TIMESTAMPTZ),public.refresh_household_due_status(UUID),
  public.record_due_provider_receipt(UUID,UUID,TEXT,TIMESTAMPTZ,BOOLEAN),public.assert_due_manual_actor(UUID,UUID),
  public.reverse_manual_household_dues(UUID,UUID,DATE[],UUID) TO service_role;
