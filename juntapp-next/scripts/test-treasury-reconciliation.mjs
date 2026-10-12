import assert from 'node:assert/strict';
import { parseSettlementReport, settlementRowToMovement } from '../src/lib/mercadopago-treasury-report.ts';
import { calculateTreasuryStats } from '../src/lib/treasury.ts';

const csv = `\uFEFFEXTERNAL_REFERENCE;SOURCE_ID;TRANSACTION_TYPE;TRANSACTION_AMOUNT;TRANSACTION_DATE;FEE_AMOUNT;SETTLEMENT_NET_AMOUNT
"juntapp-due:due:junta:household";1001;SETTLEMENT;5000;2026-08-11T10:00:00.000-04:00;-180;4820
"retiro; banco";1002;WITHDRAWAL;-4820;2026-08-11T11:00:00.000-04:00;0;-4820
refund-1;1003;REFUND;-5000;2026-08-11T12:00:00.000-04:00;0;-5000`;

const rows = parseSettlementReport(csv);
assert.equal(rows.length, 3);
assert.equal(rows[1].EXTERNAL_REFERENCE, 'retiro; banco', 'respeta delimitadores dentro de campos citados');

const settlement = settlementRowToMovement(rows[0]);
assert.deepEqual(
  { kind: settlement.accountingKind, type: settlement.type, gross: settlement.gross, fee: settlement.fee, net: settlement.net, category: settlement.category },
  { kind: 'income', type: 'ingreso', gross: 5000, fee: 180, net: 4820, category: 'cuota_social' },
);

const withdrawal = settlementRowToMovement(rows[1]);
assert.equal(withdrawal.accountingKind, 'transfer', 'un retiro bancario no es un gasto');
assert.equal(withdrawal.net, -4820);

const refund = settlementRowToMovement(rows[2]);
assert.equal(refund.accountingKind, 'expense');
assert.equal(refund.category, 'reembolso');
assert.equal(refund.net, -5000);

assert.equal(settlement.eventKey, settlementRowToMovement(rows[0]).eventKey, 'la clave idempotente debe ser estable');
assert.notEqual(settlement.eventKey, withdrawal.eventKey, 'movimientos distintos deben tener claves distintas');

const spanishHeaders = settlementRowToMovement({
  REFERENCIA_EXTERNA: 'aporte-extraordinario',
  ID_DE_OPERACION: '2001',
  TIPO_DE_TRANSACCION: 'SETTLEMENT',
  MONTO_DE_TRANSACCION: '10,50',
  FECHA_DE_TRANSACCION: '2026-08-11T13:00:00Z',
  MONTO_DE_COMISION: '-0,50',
  MONTO_NETO_DE_LIQUIDACION: '10,00',
});
assert.equal(spanishHeaders.gross, 10.5);
assert.equal(spanishHeaders.fee, 0.5);
assert.equal(spanishHeaders.net, 10);

const largeLedger = Array.from({ length: 1205 }, (_, index) => ({
  id: `movement-${index}`,
  type: 'ingreso',
  amount: 1000,
  gross_amount: 1000,
  fee_amount: 10,
  net_amount: 990,
  accounting_kind: 'income',
}));
const largeStats = calculateTreasuryStats(largeLedger);
assert.equal(largeStats.income, 1_205_000, 'el resumen debe incluir más de 1000 movimientos');
assert.equal(largeStats.fees, 12_050);
assert.equal(largeStats.balance, 1_192_950);

console.log('Treasury reconciliation tests passed.');
