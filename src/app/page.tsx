'use client';

import { DashboardLayout } from "@/app/layout/dashboard-layout"
import { ThemeProvider } from "@/components/theme-provider"
import { useEffect, useContext } from 'react';
import { useRouter } from 'next/navigation';
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
import { useDashboardStore } from './dashboard/viewModel/DashboardViewModel';
import { useServiceSearches } from '@/hooks/useServiceSearches';
import { useAppointmentMetrics } from '@/hooks/useAppointmentMetrics';

export default function Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { metrics, isLoading, error, fetchMetrics } = useDashboardStore();
  const { user, isAuthenticated } = useAuthStore();
  
  // Usuário autenticado com company_id para filtrar os dados

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  if (isLoading) {
    return (
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
        storageKey="dashboard-theme"
      >
        <DashboardLayout>
          <div className="flex items-center justify-center h-full">Carregando...</div>
        </DashboardLayout>
      </ThemeProvider>
    );
  }

  if (error) {
    return (
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
        storageKey="dashboard-theme"
      >
        <DashboardLayout>
          <div className="flex items-center justify-center h-full text-red-500">Erro: {error}</div>
        </DashboardLayout>
      </ThemeProvider>
    );
  }

  const monthLabels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul'];
  const hourLabels = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00'];

  const { searches, loading: loadingSearches, error: searchesError } = useServiceSearches(10, true, user?.company_id);
  
  // Passa o company_id para o hook useAppointmentMetrics para filtrar os atendimentos
  const { metrics: appointmentMetrics, loading: loadingAppointments, error: appointmentsError } = useAppointmentMetrics(user?.company_id);

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
          
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
            <StatCard
              title="Consultas Realizadas"
              value={loadingAppointments ? "Carregando..." : appointmentMetrics.total.toLocaleString('pt-BR')}
              icon={<Stethoscope className="h-5 w-5 text-[#00897B]" />}
              trend={appointmentMetrics.percentChange !== undefined ? { 
                value: appointmentMetrics.percentChange, 
                isPositive: appointmentMetrics.percentChange >= 0 
              } : undefined}
            />
            
            <StatCard
              title="Tempo Médio de Consulta"
              value={loadingAppointments ? "Carregando..." : `${appointmentMetrics.averageTime || 0} min`}
              icon={<Activity className="h-5 w-5 text-[#00897B]" />}
              trend={{ value: -5, isPositive: true }}
            />
            
            <StatCard
              title="Taxa de Comparecimento"
              value={loadingAppointments ? "Carregando..." : `${appointmentMetrics.resolutionRate || 0}%`}
              icon={<HeartHandshake className="h-5 w-5 text-[#00897B]" />}
              trend={{ value: 3, isPositive: true }}
            />

            <StatCard
              title="Satisfação do Paciente"
              value="4.8"
              icon={<Star className="h-5 w-5 text-[#00897B]" />}
              trend={{ value: 2, isPositive: true }}
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2 mb-6">
            <InteractionsChart
              data={[65, 70, 68, 74, 76, 78, 82]}
              labels={monthLabels}
              title="Volume de Consultas"
              type="line"
              fillArea={true}
            />
            
            <InteractionsChart
              data={[8.2, 7.5, 9.1, 8.5, 7.8, 8.2]}
              labels={hourLabels}
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
                          <Badge variant="outline" className="bg-teal-50 text-[#00897B] border-teal-200">
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
              score={75}
              promoters={650}
              passives={250}
              detractors={100}
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Agendamentos Confirmados"
              value="85%"
              icon={<CalendarCheck className="h-5 w-5 text-[#00897B]" />}
              trend={{ value: 4, isPositive: true }}
            />
            
            <StatCard
              title="Tempo de Espera"
              value="1.2 min"
              icon={<Clock className="h-5 w-5 text-[#00897B]" />}
              trend={{ value: -15, isPositive: true }}
            />
            
            <StatCard
              title="Recepcionistas Ativas"
              value="24"
              icon={<UserCheck className="h-5 w-5 text-[#00897B]" />}
              trend={{ value: 2, isPositive: true }}
            />

            <StatCard
              title="Taxa de Cancelamento"
              value="3.2%"
              icon={<TrendingUp className="h-5 w-5 text-[#00897B]" />}
              trend={{ value: -8, isPositive: true }}
            />
          </div>
        </div>
      </DashboardLayout>
    </ThemeProvider>
  );
}
