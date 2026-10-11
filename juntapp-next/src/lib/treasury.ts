export type TreasuryTransaction = {
  type: 'ingreso' | 'egreso';
  amount: number | string;
  accounting_kind?: 'income' | 'expense' | 'transfer' | 'adjustment' | null;
  gross_amount?: number | string | null;
  fee_amount?: number | string | null;
  net_amount?: number | string | null;
};

export type TreasuryStats = {
  income: number;
  expenses: number;
  fees: number;
  balance: number;
};

/** Uses the same accounting semantics in Inicio, Tesorería and reports. */
export function calculateTreasuryStats(transactions: TreasuryTransaction[]): TreasuryStats {
  return transactions.reduce<TreasuryStats>((summary, transaction) => {
    const kind = transaction.accounting_kind ?? (transaction.type === 'ingreso' ? 'income' : 'expense');
    if (kind === 'transfer') return summary;

    const gross = Number(transaction.gross_amount ?? transaction.amount);
    const fee = Number(transaction.fee_amount ?? 0);
    const net = Number(transaction.net_amount ?? (transaction.type === 'ingreso' ? transaction.amount : -Number(transaction.amount)));
    if (!Number.isFinite(gross) || !Number.isFinite(net)) return summary;

    if (kind === 'income') {
      summary.income += gross;
      summary.fees += fee;
      summary.expenses += fee;
    } else if (kind === 'expense') {
      summary.expenses += Math.abs(net);
    }
    summary.balance += net;
    return summary;
  }, { income: 0, expenses: 0, fees: 0, balance: 0 });
}
