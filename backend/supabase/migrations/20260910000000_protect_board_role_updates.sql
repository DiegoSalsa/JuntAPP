-- Protect role and board_position from client-side privilege escalation.
-- Historical UPDATE policies on profiles remain in effect for contact and roster
-- fields, but they cannot express column-level OLD/NEW comparisons. A trigger
-- reserves cargo changes for service_role / table owners (API + SECURITY DEFINER).

CREATE OR REPLACE FUNCTION public.protect_profile_board_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.role IS NOT DISTINCT FROM OLD.role
     AND NEW.board_position IS NOT DISTINCT FROM OLD.board_position THEN
    RETURN NEW;
  END IF;

  IF coalesce(auth.role(), current_user) IN ('service_role', 'postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Los cargos de directiva solo pueden modificarse por Presidencia.'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_board_fields ON public.profiles;
CREATE TRIGGER protect_profile_board_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_board_fields();

CREATE OR REPLACE FUNCTION public.current_user_board_position()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT board_position FROM public.profiles WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.current_user_board_position() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_board_position() TO authenticated;

DROP POLICY IF EXISTS "Members can update their own profile" ON public.profiles;
CREATE POLICY "Members can update their own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (
    id = auth.uid()
    AND junta_id = public.current_junta_id()
    AND role = public.current_user_role()
    AND board_position IS NOT DISTINCT FROM public.current_user_board_position()
);
