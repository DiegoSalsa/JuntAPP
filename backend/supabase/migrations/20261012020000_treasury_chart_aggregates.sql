-- Dashboard reports must not depend on the current 50-row ledger page.
-- These aggregates keep the tenant boundary in the database and preserve the
-- same accounting semantics as treasury_summary.
CREATE OR REPLACE FUNCTION public.treasury_monthly_summary(
  p_junta_id UUID,
  p_from_date DATE DEFAULT NULL,
  p_to_date DATE DEFAULT NULL,
  p_type TEXT DEFAULT NULL,
  p_source TEXT DEFAULT NULL
)
RETURNS TABLE(month_start DATE, income NUMERIC, expenses NUMERIC, fees NUMERIC, balance NUMERIC, movement_count BIGINT)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT
    date_trunc('month', t.date)::date,
    COALESCE(SUM(CASE WHEN t.accounting_kind = 'income' THEN t.gross_amount ELSE 0 END), 0),
    COALESCE(SUM(CASE
      WHEN t.accounting_kind = 'income' THEN COALESCE(t.fee_amount, 0)
      WHEN t.accounting_kind = 'expense' THEN ABS(t.net_amount)
      ELSE 0
    END), 0),
    COALESCE(SUM(CASE WHEN t.accounting_kind = 'income' THEN COALESCE(t.fee_amount, 0) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN t.accounting_kind <> 'transfer' THEN t.net_amount ELSE 0 END), 0),
    COUNT(*)
  FROM public.transactions AS t
  WHERE t.junta_id = p_junta_id
    AND (auth.role() = 'service_role' OR t.junta_id = public.current_junta_id())
    AND (p_from_date IS NULL OR t.date >= p_from_date)
    AND (p_to_date IS NULL OR t.date <= p_to_date)
    AND (p_type IS NULL OR t.type = p_type)
    AND (p_source IS NULL OR t.source = p_source)
  GROUP BY date_trunc('month', t.date)::date
  ORDER BY date_trunc('month', t.date)::date;
$$;
REVOKE ALL ON FUNCTION public.treasury_monthly_summary(UUID, DATE, DATE, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.treasury_monthly_summary(UUID, DATE, DATE, TEXT, TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.treasury_expense_breakdown(
  p_junta_id UUID,
  p_from_date DATE DEFAULT NULL,
  p_to_date DATE DEFAULT NULL,
  p_type TEXT DEFAULT NULL,
  p_source TEXT DEFAULT NULL
)
RETURNS TABLE(category TEXT, amount NUMERIC)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH scoped AS (
    SELECT t.*
    FROM public.transactions AS t
    WHERE t.junta_id = p_junta_id
      AND (auth.role() = 'service_role' OR t.junta_id = public.current_junta_id())
      AND (p_from_date IS NULL OR t.date >= p_from_date)
      AND (p_to_date IS NULL OR t.date <= p_to_date)
      AND (p_type IS NULL OR t.type = p_type)
      AND (p_source IS NULL OR t.source = p_source)
  ), expense_categories AS (
    SELECT COALESCE(scoped.category, 'otros') AS category, SUM(ABS(scoped.net_amount)) AS amount
    FROM scoped
    WHERE scoped.accounting_kind = 'expense'
    GROUP BY COALESCE(scoped.category, 'otros')
  ), fees AS (
    SELECT 'comisiones'::text AS category, SUM(COALESCE(fee_amount, 0)) AS amount
    FROM scoped
    WHERE scoped.accounting_kind = 'income' AND COALESCE(scoped.fee_amount, 0) > 0
  )
  SELECT expense_categories.category, expense_categories.amount FROM expense_categories WHERE expense_categories.amount > 0
  UNION ALL
  SELECT fees.category, fees.amount FROM fees WHERE fees.amount > 0
  ORDER BY 2 DESC, 1;
$$;
REVOKE ALL ON FUNCTION public.treasury_expense_breakdown(UUID, DATE, DATE, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.treasury_expense_breakdown(UUID, DATE, DATE, TEXT, TEXT) TO authenticated, service_role;
