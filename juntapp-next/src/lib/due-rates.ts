export type MonthlyDueRate = { effective_from: string; amount: number };

/** Recorded debts and quotes keep their snapshots; new months use their rate. */
export function dueAmountForPeriod(period: string, recordedAmount: number | null | undefined, rates: MonthlyDueRate[], fallbackAmount: number): number {
  if (recordedAmount != null) return Number(recordedAmount);
  const month = period.slice(0, 10);
  const applicable = rates.filter((rate) => rate.effective_from.slice(0, 10) <= month)
    .sort((left, right) => right.effective_from.localeCompare(left.effective_from))[0];
  return Number(applicable?.amount ?? fallbackAmount);
}
