-- Close the roster/history authorization gap introduced by the initial
-- pagination RPCs. This is intentionally incremental so an already-applied
-- migration history remains auditable and can be replayed in order.

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
  WHERE public.current_user_role() = 'dirigente'
    AND EXISTS (
      SELECT 1 FROM public.profiles AS actor
      WHERE actor.id = auth.uid()
        AND actor.junta_id = public.current_junta_id()
        AND actor.role = 'dirigente'
        AND actor.membership_status = 'active'
    )
    AND p.junta_id = public.current_junta_id()
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

-- The old unbounded history signature is removed so it cannot remain a
-- privilege-escalation path after this migration is applied.
DO $$
BEGIN
  IF to_regprocedure('public.junta_due_history(uuid[])') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.junta_due_history(UUID[]) FROM PUBLIC';
    EXECUTE 'DROP FUNCTION public.junta_due_history(UUID[])';
  END IF;
END $$;

CREATE FUNCTION public.junta_due_history(
  p_household_ids UUID[],
  p_offset INTEGER DEFAULT 0,
  p_limit INTEGER DEFAULT 200
)
RETURNS TABLE(
  household_id UUID,
  period DATE,
  status TEXT,
  amount NUMERIC,
  payment_source TEXT,
  payment_batch_id UUID,
  total_count BIGINT
)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT
    d.household_id,
    d.period,
    d.status,
    d.amount,
    d.payment_source,
    d.payment_batch_id,
    COUNT(*) OVER ()
  FROM public.member_dues AS d
  WHERE d.junta_id = public.current_junta_id()
    AND d.household_id = ANY(COALESCE(p_household_ids, ARRAY[]::UUID[]))
    AND (
      public.current_user_role() = 'dirigente'
      OR d.household_id = (
        SELECT actor.household_id
        FROM public.profiles AS actor
        WHERE actor.id = auth.uid()
          AND actor.junta_id = public.current_junta_id()
          AND actor.membership_status = 'active'
      )
    )
  ORDER BY d.household_id ASC, d.period DESC
  OFFSET GREATEST(COALESCE(p_offset, 0), 0)
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 200), 1), 200);
$$;
REVOKE ALL ON FUNCTION public.junta_due_history(UUID[], INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.junta_due_history(UUID[], INTEGER, INTEGER) TO authenticated;

-- Secretary existence is only needed by board workflows; neighbors receive a
-- constant false result and cannot use this helper as a board-roster oracle.
CREATE OR REPLACE FUNCTION public.junta_has_secretary()
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.current_user_role() = 'dirigente'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE junta_id = public.current_junta_id()
        AND role = 'dirigente'
        AND board_position = 'secretario'
        AND membership_status = 'active'
    );
$$;
REVOKE ALL ON FUNCTION public.junta_has_secretary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.junta_has_secretary() TO authenticated;
