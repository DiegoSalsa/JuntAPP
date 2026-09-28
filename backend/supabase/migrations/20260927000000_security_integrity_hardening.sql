-- Security and integrity hardening. Applied after all existing migrations.

CREATE TABLE IF NOT EXISTS public.member_invitations (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  junta_id UUID NOT NULL REFERENCES public.juntas(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  rut TEXT NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()) + interval '7 days',
  used_at TIMESTAMPTZ,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.member_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.member_invitations FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.member_invitations TO service_role;

CREATE OR REPLACE FUNCTION public.consume_member_invitation(p_junta_id UUID, p_email TEXT, p_rut TEXT, p_auth_user_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE invitation_id UUID;
BEGIN
  UPDATE public.member_invitations
  SET used_at = timezone('utc'::text, now()), auth_user_id = p_auth_user_id
  WHERE id = (
    SELECT id FROM public.member_invitations
    WHERE junta_id = p_junta_id AND lower(email) = lower(p_email) AND rut = upper(p_rut)
      AND used_at IS NULL AND expires_at > timezone('utc'::text, now())
    ORDER BY created_at DESC LIMIT 1 FOR UPDATE
  )
  RETURNING id INTO invitation_id;
  IF invitation_id IS NULL THEN RAISE EXCEPTION 'Invitacion invalida, vencida o ya utilizada'; END IF;
  RETURN invitation_id;
END; $$;
REVOKE ALL ON FUNCTION public.consume_member_invitation(UUID,TEXT,TEXT,UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_member_invitation(UUID,TEXT,TEXT,UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  target_junta_id UUID; target_household_id UUID; target_role TEXT := 'vecino'; target_position TEXT := NULL; target_cuota TEXT := 'pendiente';
  junta_action TEXT := coalesce(NEW.raw_user_meta_data->>'junta_action','join'); requested_code TEXT := upper(trim(NEW.raw_user_meta_data->>'invite_code'));
  requested_phone TEXT := trim(NEW.raw_user_meta_data->>'phone'); requested_address TEXT := trim(NEW.raw_user_meta_data->>'address');
  requested_region TEXT := trim(NEW.raw_user_meta_data->>'junta_region'); requested_comuna TEXT := trim(NEW.raw_user_meta_data->>'junta_comuna');
  requested_plan TEXT := coalesce(NEW.raw_user_meta_data->>'subscription_plan','juntapp'); requested_whatsapp BOOLEAN := coalesce((NEW.raw_user_meta_data->>'whatsapp_addon')::boolean,false);
  approved_application UUID := nullif(NEW.raw_user_meta_data->>'approved_application_id','')::uuid;
  invitation_id UUID; base_price INTEGER; new_invite_code TEXT; new_slug TEXT;
BEGIN
  IF char_length(regexp_replace(coalesce(requested_phone,''),'[^0-9]','','g')) < 9 THEN RAISE EXCEPTION 'El numero de celular es obligatorio'; END IF;
  IF char_length(requested_address) < 3 THEN RAISE EXCEPTION 'La direccion es obligatoria'; END IF;
  IF junta_action = 'create' THEN
    IF requested_plan NOT IN ('juntapp','juntapp_web','web') THEN requested_plan := 'juntapp'; END IF;
    base_price := CASE requested_plan WHEN 'web' THEN 9990 WHEN 'juntapp_web' THEN 22990 ELSE 14990 END;
    IF requested_whatsapp THEN base_price := base_price + 7990; END IF;
    IF char_length(trim(NEW.raw_user_meta_data->>'junta_name')) < 3 OR requested_region = '' OR requested_comuna = '' THEN RAISE EXCEPTION 'Datos de la junta incompletos'; END IF;
    LOOP new_invite_code := upper(substr(replace(extensions.uuid_generate_v4()::text,'-',''),1,6)); EXIT WHEN NOT EXISTS (SELECT 1 FROM public.juntas WHERE invite_code=new_invite_code); END LOOP;
    new_slug := trim(both '-' from regexp_replace(lower(translate(NEW.raw_user_meta_data->>'junta_name','áéíóúüñÁÉÍÓÚÜÑ','aeiouunAEIOUUN')),'[^a-z0-9]+','-','g')) || '-' || substr(replace(extensions.uuid_generate_v4()::text,'-',''),1,8);
    INSERT INTO public.juntas(name,slug,comuna,region,invite_code,owner_id,subscription_status,subscription_price,subscription_plan,whatsapp_addon)
    VALUES(trim(NEW.raw_user_meta_data->>'junta_name'),new_slug,requested_comuna,requested_region,new_invite_code,NEW.id,'pending',base_price,requested_plan,requested_whatsapp) RETURNING id INTO target_junta_id;
    target_role := 'dirigente'; target_position := 'presidente'; target_cuota := 'al_dia';
  ELSE
    SELECT id INTO target_junta_id FROM public.juntas WHERE invite_code=requested_code AND subscription_status='authorized';
    IF target_junta_id IS NULL THEN RAISE EXCEPTION 'Codigo invalido o junta inactiva'; END IF;
    IF approved_application IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM public.membership_applications a WHERE a.id=approved_application AND a.junta_id=target_junta_id AND a.status='approved' AND lower(a.email)=lower(NEW.email) AND a.rut=upper(NEW.raw_user_meta_data->>'rut')) THEN RAISE EXCEPTION 'La solicitud aprobada no es valida'; END IF;
      UPDATE public.membership_applications SET status='activated', updated_at=timezone('utc'::text, now()) WHERE id=approved_application AND status='approved';
    ELSE
      SELECT id INTO invitation_id FROM public.member_invitations WHERE junta_id=target_junta_id AND lower(email)=lower(NEW.email) AND rut=upper(NEW.raw_user_meta_data->>'rut') AND used_at IS NULL AND expires_at > timezone('utc'::text, now()) ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
      IF invitation_id IS NULL THEN RAISE EXCEPTION 'La invitacion debe ser emitida por la directiva'; END IF;
      UPDATE public.member_invitations SET used_at=timezone('utc'::text, now()), auth_user_id=NEW.id WHERE id=invitation_id;
    END IF;
  END IF;
  INSERT INTO public.households(junta_id,address,normalized_address)
  VALUES(target_junta_id,requested_address,public.normalize_member_address(requested_address))
  ON CONFLICT (junta_id,normalized_address) DO UPDATE SET updated_at=timezone('utc'::text, now())
  RETURNING id INTO target_household_id;
  IF junta_action <> 'create' AND EXISTS (SELECT 1 FROM public.member_dues WHERE household_id=target_household_id AND period=(timezone('America/Santiago', now())::date - (extract(day from timezone('America/Santiago', now()))::int - 1)) AND status='paid') THEN target_cuota := 'al_dia'; END IF;
  INSERT INTO public.profiles(id,junta_id,household_id,name,rut,address,phone,email,role,board_position,cuota_status)
  VALUES(NEW.id,target_junta_id,target_household_id,trim(NEW.raw_user_meta_data->>'name'),upper(NEW.raw_user_meta_data->>'rut'),requested_address,requested_phone,NEW.email,target_role,target_position,target_cuota);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.protect_junta_server_fields()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF (NEW.owner_id, NEW.invite_code, NEW.subscription_status, NEW.subscription_price, NEW.subscription_plan, NEW.billing_mode, NEW.trial_ends_at, NEW.trial_warning_sent_at, NEW.trial_expired_at, NEW.trial_expired_notice_sent_at, NEW.billing_notes, NEW.subscription_next_payment_date, NEW.mercadopago_preference_id, NEW.mercadopago_payment_id, NEW.mercadopago_subscription_id, NEW.activated_at)
     IS NOT DISTINCT FROM
     (OLD.owner_id, OLD.invite_code, OLD.subscription_status, OLD.subscription_price, OLD.subscription_plan, OLD.billing_mode, OLD.trial_ends_at, OLD.trial_warning_sent_at, OLD.trial_expired_at, OLD.trial_expired_notice_sent_at, OLD.billing_notes, OLD.subscription_next_payment_date, OLD.mercadopago_preference_id, OLD.mercadopago_payment_id, OLD.mercadopago_subscription_id, OLD.activated_at)
  THEN RETURN NEW; END IF;
  IF coalesce(auth.role(), current_user) IN ('service_role','postgres','supabase_admin') THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Los campos de suscripcion y propietario solo pueden modificarse en el servidor' USING ERRCODE='42501';
END; $$;
DROP TRIGGER IF EXISTS protect_junta_server_fields ON public.juntas;
CREATE TRIGGER protect_junta_server_fields BEFORE UPDATE ON public.juntas FOR EACH ROW EXECUTE FUNCTION public.protect_junta_server_fields();

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS membership_status TEXT NOT NULL DEFAULT 'active' CHECK (membership_status IN ('active','inactive'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS inactive_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS inactive_reason TEXT;
CREATE INDEX IF NOT EXISTS idx_profiles_active_junta ON public.profiles(junta_id) WHERE membership_status='active';
DROP POLICY IF EXISTS "Members can read profiles in their junta" ON public.profiles;
CREATE POLICY "Members can read own profile or board roster" ON public.profiles FOR SELECT TO authenticated USING (id=auth.uid() OR (junta_id=public.current_junta_id() AND public.current_user_role()='dirigente'));
DROP POLICY IF EXISTS "Dirigentes can delete profiles in their junta" ON public.profiles;
REVOKE DELETE ON public.profiles FROM authenticated;

CREATE OR REPLACE FUNCTION public.protect_profile_admin_fields()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF coalesce(auth.role(), current_user) = 'authenticated' AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND membership_status='active') THEN
    RAISE EXCEPTION 'La membresia esta inactiva' USING ERRCODE='42501';
  END IF;
  IF coalesce(auth.role(), current_user) NOT IN ('service_role','postgres','supabase_admin') THEN
    IF NEW.email IS DISTINCT FROM OLD.email OR NEW.name IS DISTINCT FROM OLD.name OR NEW.address IS DISTINCT FROM OLD.address THEN
      RAISE EXCEPTION 'El correo se cambia mediante Auth y los datos del padron son administrativos' USING ERRCODE='42501';
    END IF;
    IF NEW.phone IS DISTINCT FROM OLD.phone AND auth.uid() IS DISTINCT FROM NEW.id THEN
      RAISE EXCEPTION 'Solo puedes modificar tu propio telefono' USING ERRCODE='42501';
    END IF;
  END IF;
  IF (NEW.role,NEW.board_position,NEW.rut,NEW.junta_id,NEW.household_id,NEW.cuota_status,NEW.membership_status,NEW.inactive_at,NEW.inactive_reason)
     IS NOT DISTINCT FROM (OLD.role,OLD.board_position,OLD.rut,OLD.junta_id,OLD.household_id,OLD.cuota_status,OLD.membership_status,OLD.inactive_at,OLD.inactive_reason)
  THEN RETURN NEW; END IF;
  IF coalesce(auth.role(), current_user) IN ('service_role','postgres','supabase_admin') THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Los campos administrativos del padrón solo pueden modificarse en el servidor' USING ERRCODE='42501';
END; $$;
DROP TRIGGER IF EXISTS protect_profile_admin_fields ON public.profiles;
CREATE TRIGGER protect_profile_admin_fields BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_profile_admin_fields();

CREATE TABLE IF NOT EXISTS public.poll_participation (
  poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text,now()),
  PRIMARY KEY (poll_id,user_id)
);
CREATE TABLE IF NOT EXISTS public.poll_ballots (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE RESTRICT,
  option_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text,now())
);
ALTER TABLE public.poll_participation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_ballots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.poll_participation, public.poll_ballots FROM anon, authenticated;
GRANT SELECT ON public.poll_participation TO service_role;
GRANT SELECT,INSERT ON public.poll_ballots TO service_role;
INSERT INTO public.poll_participation(poll_id,user_id,created_at) SELECT poll_id,user_id,min(created_at) FROM public.votes WHERE user_id IS NOT NULL GROUP BY poll_id,user_id ON CONFLICT DO NOTHING;
INSERT INTO public.poll_ballots(poll_id,option_id,created_at) SELECT poll_id,option_id,created_at FROM public.votes WHERE poll_id IS NOT NULL ON CONFLICT DO NOTHING;
ALTER TABLE public.votes ALTER COLUMN user_id DROP NOT NULL;
UPDATE public.votes SET user_id=NULL WHERE user_id IS NOT NULL;
REVOKE ALL ON public.votes FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.cast_anonymous_vote(p_poll_id UUID,p_option_id TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor UUID:=auth.uid(); junta UUID;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Sesion requerida'; END IF;
  SELECT junta_id INTO junta FROM public.polls WHERE id=p_poll_id AND active=true;
  IF junta IS NULL OR junta <> public.current_junta_id() THEN RAISE EXCEPTION 'Consulta no disponible'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.polls p WHERE p.id=p_poll_id AND p.options @> jsonb_build_array(jsonb_build_object('id',p_option_id))) THEN RAISE EXCEPTION 'Alternativa invalida'; END IF;
  INSERT INTO public.poll_participation(poll_id,user_id) VALUES(p_poll_id,actor) ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ya registraste tu respuesta'; END IF;
  INSERT INTO public.poll_ballots(poll_id,option_id) VALUES(p_poll_id,p_option_id);
  RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.cast_anonymous_vote(UUID,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cast_anonymous_vote(UUID,TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.poll_results(p_poll_id UUID)
RETURNS TABLE(option_id TEXT,votes BIGINT) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT b.option_id,count(*) FROM public.poll_ballots b JOIN public.polls p ON p.id=b.poll_id WHERE b.poll_id=p_poll_id AND p.junta_id=public.current_junta_id() GROUP BY b.option_id;
$$;
REVOKE ALL ON FUNCTION public.poll_results(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.poll_results(UUID) TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
  bucket_key TEXT PRIMARY KEY,
  window_started TIMESTAMPTZ NOT NULL,
  hits INTEGER NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
REVOKE ALL ON public.rate_limit_buckets FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.rate_limit_buckets TO service_role;
CREATE OR REPLACE FUNCTION public.consume_rate_limit(p_key TEXT,p_limit INTEGER,p_window_seconds INTEGER)
RETURNS TABLE(allowed BOOLEAN,remaining INTEGER,reset_at TIMESTAMPTZ) LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE now_utc TIMESTAMPTZ:=timezone('utc'::text,now()); row public.rate_limit_buckets%ROWTYPE;
BEGIN
  DELETE FROM public.rate_limit_buckets WHERE expires_at <= now_utc;
  SELECT * INTO row FROM public.rate_limit_buckets WHERE bucket_key=p_key FOR UPDATE;
  IF row.bucket_key IS NULL OR row.expires_at <= now_utc THEN
    INSERT INTO public.rate_limit_buckets(bucket_key,window_started,hits,expires_at) VALUES(p_key,now_utc,1,now_utc+make_interval(secs=>p_window_seconds)) ON CONFLICT(bucket_key) DO UPDATE SET window_started=excluded.window_started,hits=1,expires_at=excluded.expires_at;
    RETURN QUERY SELECT true,p_limit-1,now_utc+make_interval(secs=>p_window_seconds); RETURN;
  END IF;
  IF row.hits >= p_limit THEN RETURN QUERY SELECT false,0,row.expires_at; RETURN; END IF;
  UPDATE public.rate_limit_buckets SET hits=hits+1 WHERE bucket_key=p_key;
  RETURN QUERY SELECT true,p_limit-row.hits-1,row.expires_at;
END; $$;
REVOKE ALL ON FUNCTION public.consume_rate_limit(TEXT,INTEGER,INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(TEXT,INTEGER,INTEGER) TO service_role;

-- Historical child rows retain their profile references; logical deactivation avoids auth cascades.



CREATE OR REPLACE FUNCTION public.has_poll_participated(p_poll_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.poll_participation pp JOIN public.polls p ON p.id=pp.poll_id WHERE pp.poll_id=p_poll_id AND pp.user_id=auth.uid() AND p.junta_id=public.current_junta_id());
$$;
REVOKE ALL ON FUNCTION public.has_poll_participated(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_poll_participated(UUID) TO authenticated;




CREATE OR REPLACE FUNCTION public.sync_auth_email_to_profile()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN UPDATE public.profiles SET email=NEW.email WHERE id=NEW.id; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS sync_auth_email_to_profile ON auth.users;
CREATE TRIGGER sync_auth_email_to_profile AFTER UPDATE OF email ON auth.users FOR EACH ROW EXECUTE FUNCTION public.sync_auth_email_to_profile();


CREATE OR REPLACE FUNCTION public.board_contacts(p_junta_id UUID DEFAULT NULL)
RETURNS TABLE(id UUID,name TEXT,board_position TEXT,phone TEXT,email TEXT) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT id,name,board_position,phone,email FROM public.profiles
  WHERE junta_id=public.current_junta_id() AND junta_id=coalesce(p_junta_id,public.current_junta_id()) AND role='dirigente' AND membership_status='active';
$$;
REVOKE ALL ON FUNCTION public.board_contacts(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.board_contacts(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.current_junta_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT junta_id FROM public.profiles WHERE id=auth.uid() AND membership_status='active';
$$;
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT role FROM public.profiles WHERE id=auth.uid() AND membership_status='active';
$$;
CREATE OR REPLACE FUNCTION public.is_active_member()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND membership_status='active');
$$;
REVOKE ALL ON FUNCTION public.is_active_member() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_member() TO authenticated;

DROP POLICY IF EXISTS "Members can read own profile or board roster" ON public.profiles;
CREATE POLICY "Members can read own profile or board roster"
ON public.profiles FOR SELECT TO authenticated
USING ((id=auth.uid() AND membership_status='active') OR (junta_id=public.current_junta_id() AND public.current_user_role()='dirigente' AND membership_status='active'));

DROP POLICY IF EXISTS "Users can read their notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete their notifications" ON public.notifications;
CREATE POLICY "Users can read their notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id=auth.uid() AND public.is_active_member());
CREATE POLICY "Users can update their notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id=auth.uid() AND public.is_active_member()) WITH CHECK (user_id=auth.uid() AND public.is_active_member());
CREATE POLICY "Users can delete their notifications" ON public.notifications FOR DELETE TO authenticated USING (user_id=auth.uid() AND public.is_active_member());

DROP POLICY IF EXISTS "Users can read their push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can create their push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can update their push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can delete their push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can read their push subscriptions" ON public.push_subscriptions FOR SELECT TO authenticated USING (user_id=auth.uid() AND public.is_active_member());
CREATE POLICY "Users can create their push subscriptions" ON public.push_subscriptions FOR INSERT TO authenticated WITH CHECK (user_id=auth.uid() AND public.is_active_member());
CREATE POLICY "Users can update their push subscriptions" ON public.push_subscriptions FOR UPDATE TO authenticated USING (user_id=auth.uid() AND public.is_active_member()) WITH CHECK (user_id=auth.uid() AND public.is_active_member());
CREATE POLICY "Users can delete their push subscriptions" ON public.push_subscriptions FOR DELETE TO authenticated USING (user_id=auth.uid() AND public.is_active_member());
-- Final field-level protections and Chile-local accounting period.
CREATE OR REPLACE FUNCTION public.protect_profile_admin_fields()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF coalesce(auth.role(), current_user) = 'authenticated' AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND membership_status='active') THEN
    RAISE EXCEPTION 'La membresia esta inactiva' USING ERRCODE='42501';
  END IF;
  IF coalesce(auth.role(), current_user) NOT IN ('service_role','postgres','supabase_admin') THEN
    IF NEW.email IS DISTINCT FROM OLD.email OR NEW.name IS DISTINCT FROM OLD.name OR NEW.address IS DISTINCT FROM OLD.address THEN
      RAISE EXCEPTION 'El correo se cambia mediante Auth y los datos del padron son administrativos' USING ERRCODE='42501';
    END IF;
    IF NEW.phone IS DISTINCT FROM OLD.phone AND auth.uid() IS DISTINCT FROM NEW.id THEN
      RAISE EXCEPTION 'Solo puedes modificar tu propio telefono' USING ERRCODE='42501';
    END IF;
  END IF;
  IF (NEW.id,NEW.role,NEW.board_position,NEW.rut,NEW.junta_id,NEW.household_id,NEW.cuota_status,NEW.membership_status,NEW.inactive_at,NEW.inactive_reason,NEW.created_at)
     IS NOT DISTINCT FROM (OLD.id,OLD.role,OLD.board_position,OLD.rut,OLD.junta_id,OLD.household_id,OLD.cuota_status,OLD.membership_status,OLD.inactive_at,OLD.inactive_reason,OLD.created_at)
  THEN RETURN NEW; END IF;
  IF coalesce(auth.role(), current_user) IN ('service_role','postgres','supabase_admin') THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Los campos administrativos del padron solo pueden modificarse en el servidor' USING ERRCODE='42501';
END; $$;

CREATE OR REPLACE FUNCTION public.protect_junta_server_fields()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE trusted BOOLEAN := coalesce(auth.role(), current_user) IN ('service_role','postgres','supabase_admin');
BEGIN
  IF NEW.monthly_due_amount IS DISTINCT FROM OLD.monthly_due_amount
     AND (NEW.id,NEW.owner_id,NEW.invite_code,NEW.subscription_status,NEW.subscription_price,NEW.subscription_plan,NEW.whatsapp_addon,NEW.billing_mode,NEW.trial_ends_at,NEW.trial_warning_sent_at,NEW.trial_expired_at,NEW.trial_expired_notice_sent_at,NEW.billing_notes,NEW.subscription_next_payment_date,NEW.mercadopago_preference_id,NEW.mercadopago_payment_id,NEW.mercadopago_subscription_id,NEW.activated_at,NEW.subscription_last_payment_status,NEW.subscription_last_synced_at,NEW.created_at)
         IS NOT DISTINCT FROM
         (OLD.id,OLD.owner_id,OLD.invite_code,OLD.subscription_status,OLD.subscription_price,OLD.subscription_plan,OLD.whatsapp_addon,OLD.billing_mode,OLD.trial_ends_at,OLD.trial_warning_sent_at,OLD.trial_expired_at,OLD.trial_expired_notice_sent_at,OLD.billing_notes,OLD.subscription_next_payment_date,OLD.mercadopago_preference_id,OLD.mercadopago_payment_id,OLD.mercadopago_subscription_id,OLD.activated_at,OLD.subscription_last_payment_status,OLD.subscription_last_synced_at,OLD.created_at)
  THEN
    IF trusted OR EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND junta_id=NEW.id AND membership_status='active' AND board_position IN ('presidente','tesorero')) THEN RETURN NEW; END IF;
    RAISE EXCEPTION 'Solo Presidencia o Tesoreria puede modificar la cuota mensual' USING ERRCODE='42501';
  END IF;
  IF (NEW.id,NEW.owner_id,NEW.invite_code,NEW.subscription_status,NEW.subscription_price,NEW.subscription_plan,NEW.whatsapp_addon,NEW.billing_mode,NEW.trial_ends_at,NEW.trial_warning_sent_at,NEW.trial_expired_at,NEW.trial_expired_notice_sent_at,NEW.billing_notes,NEW.subscription_next_payment_date,NEW.mercadopago_preference_id,NEW.mercadopago_payment_id,NEW.mercadopago_subscription_id,NEW.activated_at,NEW.subscription_last_payment_status,NEW.subscription_last_synced_at,NEW.created_at)
     IS NOT DISTINCT FROM
     (OLD.id,OLD.owner_id,OLD.invite_code,OLD.subscription_status,OLD.subscription_price,OLD.subscription_plan,OLD.whatsapp_addon,OLD.billing_mode,OLD.trial_ends_at,OLD.trial_warning_sent_at,OLD.trial_expired_at,OLD.trial_expired_notice_sent_at,OLD.billing_notes,OLD.subscription_next_payment_date,OLD.mercadopago_preference_id,OLD.mercadopago_payment_id,OLD.mercadopago_subscription_id,OLD.activated_at,OLD.subscription_last_payment_status,OLD.subscription_last_synced_at,OLD.created_at)
  THEN RETURN NEW; END IF;
  IF trusted THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Los campos de suscripcion y propietario solo pueden modificarse en el servidor' USING ERRCODE='42501';
END; $$;

CREATE OR REPLACE FUNCTION public.current_chile_date()
RETURNS DATE LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT timezone('America/Santiago', now())::date;
$$;
REVOKE ALL ON FUNCTION public.current_chile_date() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_chile_date() TO service_role;

CREATE OR REPLACE FUNCTION public.record_approved_member_due(p_due_id UUID, p_payment_id TEXT, p_paid_at TIMESTAMPTZ)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE target_due public.member_dues%ROWTYPE; dwelling public.households%ROWTYPE; payer_id UUID; new_transaction_id BIGINT;
BEGIN
  SELECT * INTO target_due FROM public.member_dues WHERE id=p_due_id FOR UPDATE;
  IF target_due.id IS NULL OR target_due.household_id IS NULL THEN RAISE EXCEPTION 'Cuota por direccion no encontrada'; END IF;
  IF target_due.status='paid' THEN
    IF target_due.mercadopago_payment_id <> p_payment_id THEN RAISE EXCEPTION 'La cuota ya fue pagada con otra transaccion'; END IF;
    RETURN target_due.transaction_id;
  END IF;
  SELECT * INTO dwelling FROM public.households WHERE id=target_due.household_id AND junta_id=target_due.junta_id;
  SELECT id INTO payer_id FROM public.profiles WHERE household_id=dwelling.id ORDER BY (id=target_due.profile_id) DESC, created_at LIMIT 1;
  INSERT INTO public.transactions(junta_id,type,description,amount,date,created_by,source,accounting_kind,account_code,category,gross_amount,fee_amount,net_amount,provider,provider_transaction_id,external_reference,verification_status,verified_at,is_immutable)
  VALUES(target_due.junta_id,'ingreso','Cuota domiciliaria '||to_char(target_due.period,'MM/YYYY')||' verificada por Mercado Pago',target_due.amount,coalesce(p_paid_at::date,public.current_chile_date()),payer_id,'mercadopago','income','mercadopago','cuota_social',target_due.amount,0,target_due.amount,'mercadopago',p_payment_id,'juntapp-due:'||target_due.id||':'||target_due.junta_id||':'||target_due.household_id,'provider_confirmed',coalesce(p_paid_at,timezone('utc'::text,now())),true)
  RETURNING id INTO new_transaction_id;
  UPDATE public.member_dues SET status='paid',payment_source='mercadopago',manual_payment_method=NULL,mercadopago_payment_id=p_payment_id,paid_at=p_paid_at,transaction_id=new_transaction_id,updated_at=timezone('utc'::text,now()) WHERE id=target_due.id;
  UPDATE public.profiles SET cuota_status='al_dia' WHERE household_id=dwelling.id AND junta_id=target_due.junta_id;
  INSERT INTO public.notifications(user_id,type,title,message,read,date,action) SELECT id,'cuota','Cuota del domicilio recibida','Mercado Pago confirmo la cuota del domicilio por $'||target_due.amount||'.',false,timezone('utc'::text,now()),'/tesoreria' FROM public.profiles WHERE household_id=dwelling.id;
  RETURN new_transaction_id;
END; $$;

CREATE OR REPLACE FUNCTION public.set_manual_household_due(p_household_id UUID, p_junta_id UUID, p_action TEXT, p_method TEXT DEFAULT NULL)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE target_due public.member_dues%ROWTYPE; dwelling public.households%ROWTYPE; due_amount INTEGER; current_period DATE:=date_trunc('month',public.current_chile_date())::date; method_label TEXT; actor_id UUID; new_transaction_id BIGINT;
BEGIN
  IF p_action NOT IN ('paid','pending') THEN RAISE EXCEPTION 'Accion de cuota invalida'; END IF;
  IF p_action='paid' AND p_method NOT IN ('cash','transfer','other') THEN RAISE EXCEPTION 'Metodo de pago manual invalido'; END IF;
  SELECT * INTO dwelling FROM public.households WHERE id=p_household_id AND junta_id=p_junta_id;
  IF dwelling.id IS NULL THEN RAISE EXCEPTION 'Direccion no encontrada'; END IF;
  SELECT monthly_due_amount INTO due_amount FROM public.juntas WHERE id=p_junta_id;
  SELECT id INTO actor_id FROM public.profiles WHERE household_id=p_household_id ORDER BY created_at LIMIT 1;
  SELECT * INTO target_due FROM public.member_dues WHERE household_id=p_household_id AND period=current_period FOR UPDATE;
  IF target_due.status='paid' AND target_due.mercadopago_payment_id IS NOT NULL THEN RAISE EXCEPTION 'La cuota fue confirmada por Mercado Pago y no puede modificarse manualmente'; END IF;
  IF p_action='pending' THEN
    IF target_due.status='paid' AND target_due.payment_source='manual' THEN
      INSERT INTO public.transactions(junta_id,type,description,amount,date,created_by) VALUES(p_junta_id,'egreso','Anulación cuota domicilio '||to_char(current_period,'MM/YYYY')||' — '||dwelling.address,target_due.amount,public.current_chile_date(),actor_id) RETURNING id INTO new_transaction_id;
      UPDATE public.member_dues SET status='pending',refund_transaction_id=new_transaction_id,paid_at=NULL,payment_source=NULL,manual_payment_method=NULL,updated_at=timezone('utc'::text,now()) WHERE id=target_due.id;
    END IF;
    UPDATE public.profiles SET cuota_status='pendiente' WHERE household_id=p_household_id;
    RETURN new_transaction_id;
  END IF;
  IF target_due.status='paid' AND target_due.payment_source='manual' THEN RETURN target_due.transaction_id; END IF;
  method_label:=CASE p_method WHEN 'cash' THEN 'Efectivo' WHEN 'transfer' THEN 'Transferencia' ELSE 'Otro medio manual' END;
  INSERT INTO public.transactions(junta_id,type,description,amount,date,created_by) VALUES(p_junta_id,'ingreso','Cuota domicilio '||to_char(current_period,'MM/YYYY')||' — '||dwelling.address||' — '||method_label,coalesce(target_due.amount,due_amount),public.current_chile_date(),actor_id) RETURNING id INTO new_transaction_id;
  INSERT INTO public.member_dues(junta_id,household_id,profile_id,period,amount,status,payment_source,manual_payment_method,paid_at,transaction_id)
  VALUES(p_junta_id,p_household_id,actor_id,current_period,due_amount,'paid','manual',p_method,timezone('utc'::text,now()),new_transaction_id)
  ON CONFLICT (household_id,period) WHERE household_id IS NOT NULL DO UPDATE SET status='paid',payment_source='manual',manual_payment_method=excluded.manual_payment_method,paid_at=excluded.paid_at,transaction_id=excluded.transaction_id,refund_transaction_id=NULL,updated_at=timezone('utc'::text,now());
  UPDATE public.profiles SET cuota_status='al_dia' WHERE household_id=p_household_id;
  INSERT INTO public.notifications(user_id,type,title,message,read,date,action) SELECT id,'cuota','Cuota del domicilio registrada','La directiva registró como pagada la cuota de '||dwelling.address||' mediante '||method_label||'.',false,timezone('utc'::text,now()),'/tesoreria' FROM public.profiles WHERE household_id=p_household_id;
  RETURN new_transaction_id;
END; $$;

CREATE OR REPLACE FUNCTION public.record_refunded_member_due(p_due_id UUID, p_payment_id TEXT)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE target_due public.member_dues%ROWTYPE; actor_id UUID; new_transaction_id BIGINT;
BEGIN
  SELECT * INTO target_due FROM public.member_dues WHERE id=p_due_id FOR UPDATE;
  IF target_due.id IS NULL OR target_due.household_id IS NULL OR target_due.mercadopago_payment_id<>p_payment_id THEN RAISE EXCEPTION 'Pago de cuota por domicilio no encontrado'; END IF;
  IF target_due.status='refunded' THEN RETURN target_due.refund_transaction_id; END IF;
  IF target_due.status<>'paid' THEN RAISE EXCEPTION 'La cuota no se encuentra pagada'; END IF;
  SELECT id INTO actor_id FROM public.profiles WHERE household_id=target_due.household_id ORDER BY (id=target_due.profile_id) DESC,created_at LIMIT 1;
  INSERT INTO public.transactions(junta_id,type,description,amount,date,created_by,source,accounting_kind,account_code,category,gross_amount,fee_amount,net_amount,provider,provider_transaction_id,verification_status,verified_at,is_immutable)
  VALUES(target_due.junta_id,'egreso','Reembolso de cuota verificado por Mercado Pago',target_due.amount,public.current_chile_date(),actor_id,'mercadopago','expense','mercadopago','reembolso_cuota',target_due.amount,0,-target_due.amount,'mercadopago',p_payment_id,'provider_confirmed',timezone('utc'::text,now()),true)
  RETURNING id INTO new_transaction_id;
  UPDATE public.member_dues SET status='refunded',refund_transaction_id=new_transaction_id,updated_at=timezone('utc'::text,now()) WHERE id=target_due.id;
  UPDATE public.profiles SET cuota_status='pendiente' WHERE household_id=target_due.household_id;
  INSERT INTO public.notifications(user_id,type,title,message,read,date,action) SELECT id,'cuota','Cuota reembolsada','Mercado Pago informo el reembolso de la cuota del domicilio.',false,timezone('utc'::text,now()),'/tesoreria' FROM public.profiles WHERE household_id=target_due.household_id;
  RETURN new_transaction_id;
END; $$;
