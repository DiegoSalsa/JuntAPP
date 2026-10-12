-- Keep roster pagination, due filtering and history independent from implicit
-- PostgREST row limits. All reads are scoped to the authenticated junta.
CREATE OR REPLACE FUNCTION public.junta_roster_page(
  p_period DATE,
  p_search TEXT DEFAULT NULL,
  p_role TEXT DEFAULT NULL,
  p_position TEXT DEFAULT NULL,
  p_due TEXT DEFAULT NULL,
  p_offset INTEGER DEFAULT 0,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE(
  id UUID,
  junta_id UUID,
  household_id UUID,
  name TEXT,
  rut TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  role TEXT,
  board_position TEXT,
  cuota_status TEXT,
  created_at TIMESTAMPTZ,
  household_created_at TIMESTAMPTZ,
  total_count BIGINT
)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT
    p.id,
    p.junta_id,
    p.household_id,
    p.name,
    p.rut,
    p.address,
    p.phone,
    p.email,
    p.role,
    p.board_position,
    CASE WHEN EXISTS (
      SELECT 1 FROM public.member_dues AS paid
      WHERE paid.junta_id = p.junta_id
        AND paid.household_id = p.household_id
        AND paid.period = p_period
        AND paid.status = 'paid'
    ) THEN 'al_dia' ELSE 'pendiente' END,
    p.created_at,
    h.created_at,
    COUNT(*) OVER ()
  FROM public.profiles AS p
  JOIN public.households AS h ON h.id = p.household_id AND h.junta_id = p.junta_id
  WHERE p.junta_id = public.current_junta_id()
    AND p.membership_status = 'active'
    AND (p_search IS NULL OR p_search = '' OR p.name ILIKE '%' || p_search || '%' OR p.rut ILIKE '%' || p_search || '%' OR p.address ILIKE '%' || p_search || '%')
    AND (p_role IS NULL OR p_role = '' OR p.role = p_role)
    AND (p_position IS NULL OR p_position = '' OR p.board_position = p_position)
    AND (
      p_due IS NULL OR p_due = ''
      OR (p_due = 'al_dia' AND EXISTS (
        SELECT 1 FROM public.member_dues AS paid_filter
        WHERE paid_filter.junta_id = p.junta_id AND paid_filter.household_id = p.household_id AND paid_filter.period = p_period AND paid_filter.status = 'paid'
      ))
      OR (p_due = 'pendiente' AND NOT EXISTS (
        SELECT 1 FROM public.member_dues AS paid_filter
        WHERE paid_filter.junta_id = p.junta_id AND paid_filter.household_id = p.household_id AND paid_filter.period = p_period AND paid_filter.status = 'paid'
      ))
    )
  ORDER BY p.name ASC, p.id ASC
  OFFSET GREATEST(COALESCE(p_offset, 0), 0)
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
$$;
REVOKE ALL ON FUNCTION public.junta_roster_page(DATE, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.junta_roster_page(DATE, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.junta_due_history(p_household_ids UUID[])
RETURNS TABLE(
  household_id UUID,
  period DATE,
  status TEXT,
  amount NUMERIC,
  payment_source TEXT,
  mercadopago_payment_id TEXT,
  payment_batch_id UUID
)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT d.household_id, d.period, d.status, d.amount, d.payment_source, d.mercadopago_payment_id, d.payment_batch_id
  FROM public.member_dues AS d
  WHERE d.junta_id = public.current_junta_id()
    AND d.household_id = ANY(COALESCE(p_household_ids, ARRAY[]::UUID[]))
  ORDER BY d.period DESC;
$$;
REVOKE ALL ON FUNCTION public.junta_due_history(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.junta_due_history(UUID[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.junta_has_secretary()
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE junta_id = public.current_junta_id()
      AND role = 'dirigente'
      AND board_position = 'secretario'
      AND membership_status = 'active'
  );
$$;
REVOKE ALL ON FUNCTION public.junta_has_secretary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.junta_has_secretary() TO authenticated;
