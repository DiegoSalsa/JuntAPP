import assert from 'node:assert/strict';
import { dueAmountForPeriod } from '../src/lib/due-rates.ts';
import { currentChileBillingPeriod } from '../src/lib/billing-period.ts';

const rates = [
  { effective_from: '2026-10-01', amount: 8000 },
  { effective_from: '0001-01-01', amount: 10000 },
];
assert.equal(dueAmountForPeriod('2026-09-01', null, rates, 8000), 10000, 'unrecorded past month keeps its earlier rate');
assert.equal(dueAmountForPeriod('2026-09-01', 6000, rates, 8000), 6000, 'historical debt keeps its recorded amount');
assert.equal(dueAmountForPeriod('2026-10-01', null, rates, 10000), 8000, 'new current month uses the effective rate');
assert.equal(dueAmountForPeriod('2026-10-01', 10000, rates, 8000), 10000, 'paid or quoted amount keeps its snapshot');
assert.equal(dueAmountForPeriod('2027-01-01', null, rates, 10000), 8000, 'next year follows the effective rate');
assert.equal(dueAmountForPeriod('2027-01-01', 10000, rates, 8000), 10000, 'advance payment keeps its amount');
assert.equal(rates[0].effective_from, '2026-10-01', 'price lookup does not reorder caller data');
assert.equal(currentChileBillingPeriod(new Date('2026-11-01T01:30:00Z')), '2026-10', 'UTC month change does not advance the Chilean billing month');
assert.equal(currentChileBillingPeriod(new Date('2027-01-01T01:30:00Z')), '2026-12', 'UTC year change does not advance the Chilean billing year');
console.log('Due rate display and Chile billing-boundary tests passed.');
