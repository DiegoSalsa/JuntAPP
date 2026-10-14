-- Aggregations used by the dashboard. They keep the tenant boundary in the
-- database and avoid loading an arbitrary number of ledger rows in Next.js.
CREATE OR REPLACE FUNCTION public.treasury_summary(
  p_junta_id UUID,
  p_from_date DATE DEFAULT NULL,
  p_to_date DATE DEFAULT NULL,
  p_type TEXT DEFAULT NULL,
  p_source TEXT DEFAULT NULL
)
RETURNS TABLE(income NUMERIC, expenses NUMERIC, fees NUMERIC, balance NUMERIC)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT
    COALESCE(SUM(CASE WHEN t.accounting_kind = 'income' THEN t.gross_amount ELSE 0 END), 0),
    COALESCE(SUM(CASE
      WHEN t.accounting_kind = 'income' THEN COALESCE(t.fee_amount, 0)
      WHEN t.accounting_kind = 'expense' THEN ABS(t.net_amount)
      ELSE 0
    END), 0),
    COALESCE(SUM(CASE WHEN t.accounting_kind = 'income' THEN COALESCE(t.fee_amount, 0) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN t.accounting_kind <> 'transfer' THEN t.net_amount ELSE 0 END), 0)
  FROM public.transactions AS t
  WHERE t.junta_id = p_junta_id
    AND t.junta_id = public.current_junta_id()
    AND (p_from_date IS NULL OR t.date >= p_from_date)
    AND (p_to_date IS NULL OR t.date <= p_to_date)
    AND (p_type IS NULL OR t.type = p_type)
    AND (p_source IS NULL OR t.source = p_source);
$$;
REVOKE ALL ON FUNCTION public.treasury_summary(UUID, DATE, DATE, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.treasury_summary(UUID, DATE, DATE, TEXT, TEXT) TO authenticated, service_role;

-- One aggregate result set replaces one poll_results and one
-- has_poll_participated RPC call per poll. Ballots remain anonymous: only
-- counts and the current user's boolean participation are returned.
CREATE OR REPLACE FUNCTION public.poll_overview()
RETURNS TABLE(poll_id UUID, option_id TEXT, votes BIGINT, has_voted BOOLEAN)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT
    p.id,
    option_row.id,
    COUNT(b.id),
    EXISTS (
      SELECT 1
      FROM public.poll_participation AS participation
      WHERE participation.poll_id = p.id
        AND participation.user_id = auth.uid()
    )
  FROM public.polls AS p
  CROSS JOIN LATERAL jsonb_to_recordset(p.options) AS option_row(id TEXT, option_text TEXT)
  LEFT JOIN public.poll_ballots AS b
    ON b.poll_id = p.id
   AND b.option_id = option_row.id
  WHERE p.junta_id = public.current_junta_id()
  GROUP BY p.id, option_row.id;
$$;
REVOKE ALL ON FUNCTION public.poll_overview() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.poll_overview() TO authenticated;
