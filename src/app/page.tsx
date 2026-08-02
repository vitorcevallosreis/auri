'use client';

import { DashboardLayout } from "@/app/layout/dashboard-layout"
import { ThemeProvider } from "@/components/theme-provider"
import {
  Stethoscope,
  Clock,
  UserCheck,
  TrendingUp,
  HeartHandshake,
  Activity,
  Star,
  CalendarCheck
} from 'lucide-react';
import { useAuthStore } from '@/lib/auth-store';
import { StatCard } from '@/components/dashboard/StatCard';
import { InteractionsChart } from '@/components/dashboard/InteractionsChart';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NPSScore } from '@/components/dashboard/NPSScore';
import { useServiceSearches } from '@/hooks/useServiceSearches';
import { useAppointmentMetrics } from '@/hooks/useAppointmentMetrics';
import { useSatisfactionMetrics } from '@/hooks/useSatisfactionMetrics';
import { useResponseMetrics } from '@/hooks/useResponseMetrics';

const MONTH_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/** "2026-08" -> "Ago". O rótulo acompanha o que o banco devolveu; fixá-lo no
 *  código faria o gráfico mentir sobre qual mês é cada ponto. */
function monthLabel(yyyyMM: string): string {
  const month = Number(yyyyMM.split('-')[1]);
  return MONTH_ABBR[month - 1] ?? yyyyMM;
}

const hourLabel = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  const companyId = user?.company_id;

  // Todo hook é chamado incondicionalmente, antes de qualquer return. As telas
  // de carregando/erro abaixo saíam no meio da função e deixavam parte dos
  // hooks para depois — a ordem mudava entre renders e o React quebrava assim
  // que o primeiro estado de loading terminava.
  const { searches, loading: loadingSearches, error: searchesError } = useServiceSearches(10, true, companyId);
  const { metrics: appointments, loading: loadingAppointments, error: appointmentsError } = useAppointmentMetrics(companyId);
  const { metrics: satisfaction, loading: loadingSatisfaction } = useSatisfactionMetrics(companyId);
  const { metrics: response, loading: loadingResponse } = useResponseMetrics(companyId);

  const dash = (loading: boolean, value: string) => (loading ? '—' : value);

  const volumeSeries = appointments.monthly;
  const hourSeries = appointments.hourly;

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      storageKey="dashboard-theme"
    >
      <DashboardLayout>
        <div className="space-y-6 pb-8">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">Painel de Controle</h1>
          </div>

          {appointmentsError && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              Não foi possível carregar as métricas: {appointmentsError}
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
            <StatCard
              title="Consultas Realizadas"
              value={dash(loadingAppointments, appointments.finalized.toLocaleString('pt-BR'))}
              icon={<Stethoscope className="h-5 w-5 text-primary" />}
              trend={{
                value: appointments.percentChange,
                isPositive: appointments.percentChange >= 0,
              }}
            />

            <StatCard
              title="Tempo Médio de Consulta"
              value={dash(loadingAppointments, `${appointments.averageTime} min`)}
              icon={<Activity className="h-5 w-5 text-primary" />}
            />

            <StatCard
              title="Taxa de Comparecimento"
              value={dash(loadingAppointments, `${appointments.resolutionRate}%`)}
              icon={<HeartHandshake className="h-5 w-5 text-primary" />}
            />

            <StatCard
              title="Satisfação do Paciente"
              value={dash(loadingSatisfaction, satisfaction.avgRating.toFixed(1))}
              icon={<Star className="h-5 w-5 text-primary" />}
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2 mb-6">
            <InteractionsChart
              data={volumeSeries.map((p) => p.total)}
              labels={volumeSeries.map((p) => monthLabel(p.month))}
              title="Volume de Consultas"
              type="line"
              fillArea={true}
            />

            <InteractionsChart
              data={hourSeries.map((p) => p.avgMinutes)}
              labels={hourSeries.map((p) => hourLabel(p.hour))}
              title="Tempo Médio de Consulta (min)"
              type="bar"
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2 mb-6">
            <Card className="bg-card text-card-foreground border shadow-md">
              <CardHeader>
                <CardTitle className="text-base font-medium text-muted-foreground">
                  Especialidades Mais Procuradas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingSearches ? (
                  <div className="p-4 text-center">Carregando dados...</div>
                ) : searchesError ? (
                  <div className="p-4 text-center text-red-500">Erro: {searchesError}</div>
                ) : searches.length === 0 ? (
                  <div className="p-4 text-center">Nenhuma pesquisa encontrada</div>
                ) : (
                  <div className="space-y-4">
                    {searches.map((search, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="font-medium">{search.service_name || 'Serviço sem nome'}</p>
                          <p className="text-xs text-muted-foreground">
                            {search.count ? (
                              <span className="flex items-center">
                                <TrendingUp className="h-3 w-3 mr-1" />
                                <span>{search.count} {search.count > 1 ? 'pesquisas' : 'pesquisa'}</span>
                              </span>
                            ) : (
                              new Date(search.created_at).toLocaleDateString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            )}
                          </p>
                        </div>
                        <div className="text-right">
                          {/* `bg-teal-50 text-primary` sumia no tema escuro: o
                              fundo teal-50 é fixo (quase branco) e --primary vira
                              menta no escuro — 1,55:1. Menta é FUNDO tingido, com
                              texto em foreground, como já faz a sidebar. */}
                          <Badge variant="outline" className="bg-accent/15 text-foreground border-accent/40">
                            {index < 3 ? 'Mais procurado' : 'Procurado'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <NPSScore
              score={satisfaction.nps}
              promoters={satisfaction.promoters}
              passives={satisfaction.passives}
              detractors={satisfaction.detractors}
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Agendamentos Confirmados"
              value={dash(loadingAppointments, `${appointments.confirmedRate}%`)}
              icon={<CalendarCheck className="h-5 w-5 text-primary" />}
            />

            <StatCard
              title="Tempo de Espera"
              value={dash(loadingResponse, `${response.avgWaitMinutes} min`)}
              icon={<Clock className="h-5 w-5 text-primary" />}
            />

            <StatCard
              title="Recepcionistas Ativas"
              value={dash(loadingResponse, String(response.activeAssistants))}
              icon={<UserCheck className="h-5 w-5 text-primary" />}
            />

            <StatCard
              title="Taxa de Cancelamento"
              value={dash(loadingAppointments, `${appointments.cancellationRate}%`)}
              icon={<TrendingUp className="h-5 w-5 text-primary" />}
            />
          </div>
        </div>
      </DashboardLayout>
    </ThemeProvider>
  );
}
