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
                  // Dois tons por cor, um por tema. O 600 sozinho reprovava nos
                  // DOIS: verde-600 dá 3,3:1 sobre o card claro e vermelho-600
                  // dá 3,19:1 sobre o card escuro. Medido, não estimado.
                  trend.isPositive
                    ? "text-green-700 dark:text-green-400"
                    : "text-red-700 dark:text-red-400"
                )}
              >
                {/* O sinal sai do próprio número. Prefixar "+"/"-" a partir de
                    isPositive duplicava o sinal em valores negativos ("--7%") e
                    inventava um "+" em cima de um número negativo ("+-5%").
                    isPositive diz se a variação é BOA (cair o tempo de espera é
                    bom), não se ela é positiva — por isso só decide a cor. */}
                {trend.value > 0 ? "+" : ""}
                {trend.value}%
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">Sem variação</span>
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
