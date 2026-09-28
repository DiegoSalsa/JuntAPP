/** Returns the first day of the current billing month in Chile. */
export function currentChileBillingPeriod(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit' }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  if (!year || !month) throw new Error('No fue posible calcular el período de cuotas.');
  return `${year}-${month}`;
}
