'use client';

import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  icon: React.ReactNode;
}

export function StatCard({ title, value, trend, icon }: StatCardProps) {
  return (
    <div className="rounded-xl bg-card text-card-foreground p-4 border shadow-md">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          <div className="flex items-center mt-1">
            {trend ? (
              <span
                className={cn(
                  "text-xs font-medium",
                  trend.isPositive ? "text-green-600" : "text-red-600"
                )}
              >
                {trend.isPositive ? "+" : "-"}
                {trend.value}%
              </span>
            ) : (
              <span className="text-xs text-gray-400">Sem variação</span>
            )}
          </div>
        </div>
        <div className="rounded-lg bg-muted p-2">
          {icon}
        </div>
      </div>
    </div>
  );
}
