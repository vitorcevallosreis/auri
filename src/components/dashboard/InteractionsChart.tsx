'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Line, Bar } from "react-chartjs-2";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface InteractionsChartProps {
  data: number[];
  labels: string[];
  title: string;
  type?: 'line' | 'bar';
  fillArea?: boolean;
  showLegend?: boolean;
}

export function InteractionsChart({ 
  data, 
  labels, 
  title, 
  type = 'line',
  fillArea = false,
  showLegend = false 
}: InteractionsChartProps) {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  // Only render chart after mounting to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Ensure data is always an array
  const safeData = Array.isArray(data) ? data : [];
  const isDark = mounted && theme === 'dark';

  // O Chart.js pinta em <canvas>, onde `hsl(var(--primary))` NÃO resolve — o
  // canvas não participa da cascata do CSS. Então lemos o valor cru do token
  // ("189 44% 12%") e montamos a cor aqui. Assim o gráfico continua preso ao
  // design system (inclusive na troca de tema) em vez de ter a cor chumbada.
  const brand = (alpha?: number) => {
    const fallback = '189 44% 12%'; // #11282C — usado no SSR, antes de montar
    const hsl =
      mounted && typeof window !== 'undefined'
        ? getComputedStyle(document.documentElement)
            .getPropertyValue('--primary')
            .trim() || fallback
        : fallback;
    return alpha === undefined ? `hsl(${hsl})` : `hsl(${hsl} / ${alpha})`;
  };

  const chartData = {
    labels,
    datasets: [
      {
        label: title,
        data: safeData,
        borderColor: brand(),
        backgroundColor: fillArea
          ? brand(isDark ? 0.2 : 0.1)
          : type === 'bar'
            ? brand()
            : brand(isDark ? 0.2 : 0.1),
        tension: 0.4,
        fill: fillArea,
        borderWidth: type === 'line' ? 2 : 0,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: showLegend,
        labels: {
          color: isDark ? '#e2e8f0' : '#64748b',
        },
      },
      title: {
        display: false,
      },
      tooltip: {
        backgroundColor: isDark ? '#1e293b' : '#ffffff',
        titleColor: isDark ? '#e2e8f0' : '#1e293b',
        bodyColor: isDark ? '#e2e8f0' : '#1e293b',
        borderColor: isDark ? '#334155' : '#e2e8f0',
        borderWidth: 1,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          display: true,
          color: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.05)",
        },
        ticks: {
          padding: 10,
          color: isDark ? '#e2e8f0' : '#64748b',
        },
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          padding: 10,
          color: isDark ? '#e2e8f0' : '#64748b',
        },
      },
    },
  };

  return (
    <Card className="bg-card text-card-foreground border shadow-md">
      <CardHeader>
        <CardTitle className="text-base font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          {type === 'line' ? (
            <Line data={chartData} options={options} />
          ) : (
            <Bar data={chartData} options={options} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
