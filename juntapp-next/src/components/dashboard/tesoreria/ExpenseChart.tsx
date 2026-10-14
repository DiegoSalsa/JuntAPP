'use client';

import { useMemo } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import type { TreasuryExpenseBreakdown } from '@/lib/treasury';

ChartJS.register(ArcElement, Tooltip, Legend);

export default function ExpenseChart({ breakdown, error }: { breakdown: TreasuryExpenseBreakdown[]; error?: string | null }) {
  const expenses = useMemo(() => breakdown.map((item) => [categoryLabel(item.category), item.amount] as [string, number]), [breakdown]);
  const data = useMemo(() => ({ labels: expenses.map(([label]) => label), datasets: [{ data: expenses.map(([, amount]) => amount), backgroundColor: ['#ffb703', '#2563eb', '#16a34a', '#e85d04', '#8b5cf6', '#0891b2'], borderWidth: 0 }] }), [expenses]);
  if (error) return <div className="chart-empty">{error}</div>;
  if (!expenses.length) return <div className="chart-empty">No hay egresos para mostrar.</div>;
  return <Doughnut data={data} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } } }} />;
}

function categoryLabel(category: string) {
  return ({
    cuota_social: 'Cuotas sociales',
    reembolso: 'Reembolsos',
    reembolso_cuota: 'Reembolsos de cuotas',
    contracargo: 'Contracargos',
    mercadopago: 'Mercado Pago',
    comisiones: 'Comisiones',
    otros: 'Otros gastos',
  } as Record<string, string>)[category] ?? category.replaceAll('_', ' ');
}
