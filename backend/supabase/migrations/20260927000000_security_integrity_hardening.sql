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
