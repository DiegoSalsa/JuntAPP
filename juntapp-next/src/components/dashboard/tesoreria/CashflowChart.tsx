'use client';

import { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import type { TreasuryMonthlySummary } from '@/lib/treasury';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function CashflowChart({ summaries, error }: { summaries: TreasuryMonthlySummary[]; error?: string | null }) {
  const chartData = useMemo(() => {
    const summaryByMonth = new Map(summaries.map((summary) => [summary.month_start.slice(0, 7), summary]));
    const sortedMonths = [...summaryByMonth.keys()].sort();
    const labels = sortedMonths.map((m) => {
      const [year, month] = m.split('-');
      const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      return `${monthNames[parseInt(month) - 1]} ${year.slice(2)}`;
    });

    return {
      labels,
      datasets: [
        {
          label: 'Ingresos',
          data: sortedMonths.map((month) => summaryByMonth.get(month)?.income ?? 0),
          backgroundColor: 'hsl(145, 63%, 42%)',
          borderRadius: 6,
        },
        {
          label: 'Egresos',
          data: sortedMonths.map((month) => summaryByMonth.get(month)?.expenses ?? 0),
          backgroundColor: 'hsl(354, 70%, 46%)',
          borderRadius: 6,
        },
      ],
    };
  }, [summaries]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          font: { size: 12 },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: unknown) => `$${(Number(value) / 1000).toFixed(0)}k`,
        },
        grid: { color: 'rgba(0,0,0,0.04)' },
      },
      x: {
        grid: { display: false },
      },
    },
  };

  if (error) return <div className="chart-empty">{error}</div>;
  if (summaries.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-gray-500">
        No hay datos para mostrar el gráfico.
      </div>
    );
  }

  return <Bar data={chartData} options={options} />;
}
