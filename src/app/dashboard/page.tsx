'use client';

import { useEffect } from 'react';
import { MessageSquare, Clock, BarChart2 } from 'lucide-react';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { InteractionsChart } from '@/components/dashboard/InteractionsChart';
import { NextAppointmentsCard } from '@/components/dashboard/NextAppointmentsCard';
import { useDashboardStore } from './viewModel/DashboardViewModel';
import { useTopSearchedServices } from '@/hooks/useTopSearchedServices';
import { TopProductsTable } from '@/components/dashboard/TopProductsTable';
import { useAuthStore } from '@/lib/auth-store';

export default function DashboardPage() {
  console.log('[DashboardPage] ========== PÁGINA DO DASHBOARD RENDERIZADA ==========');
  const { metrics, isLoading, error, fetchMetrics } = useDashboardStore();
  const { user, isAuthenticated } = useAuthStore();
  
  console.log('[DashboardPage] useAuthStore state:', { user, isAuthenticated });
  console.log('[DashboardPage] company_id do store:', user?.company_id);
  
  console.log('[DashboardPage] Chamando useTopSearchedServices com company_id:', user?.company_id);
  const { services, loading: loadingServices, error: errorServices } = useTopSearchedServices(user?.company_id);
  console.log('[DashboardPage] Resultado do useTopSearchedServices:', { services, loadingServices, errorServices });

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);
  
  // Prepare content based on loading and error states
  let content;
  
  if (isLoading) {
    content = <div>Carregando...</div>;
  } else if (error) {
    content = <div>Erro: {error}</div>;
  } else {
    const dailyLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const weeklyLabels = ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4', 'Semana 5'];

    content = (
      <div className="p-6 space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>

        {/* Card de Serviços Mais Procurados */}
        <div>
          {loadingServices ? (
            <div>Carregando serviços mais procurados...</div>
          ) : errorServices ? (
            <div>Erro ao carregar serviços: {errorServices}</div>
          ) : (
            <TopProductsTable services={services} />
          )}
        </div>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <MetricCard
            title="Taxa de Engajamento"
            value={`${metrics.engagementRate}%`}
            icon={<BarChart2 className="h-4 w-4 text-[#00897B]" />}
            description="Média de engajamento nas conversas"
            trend={{ value: 12, isPositive: true }}
          />
          
          <MetricCard
            title="Tempo Médio de Resposta"
            value={`${metrics.averageResponseTime}min`}
            icon={<Clock className="h-4 w-4 text-[#00897B]" />}
            description="Tempo médio para responder mensagens"
            trend={{ value: 8, isPositive: false }}
          />
          
          <MetricCard
            title="Total de Interações"
            value={metrics.totalInteractions.toLocaleString()}
            icon={<MessageSquare className="h-4 w-4 text-[#00897B]" />}
            description="Número total de interações"
            trend={{ value: 23, isPositive: true }}
          />
        </div>

        {/* Card de Próximas Consultas */}
        <NextAppointmentsCard 
          appointments={[
            { id: '1', patientName: 'Ana Silva', appointmentType: 'Consulta de Rotina', time: '09:00' },
            { id: '2', patientName: 'Carlos Pereira', appointmentType: 'Limpeza Dental', time: '10:30' },
            { id: '3', patientName: 'Mariana Costa', appointmentType: 'Retorno', time: '11:15' },
            { id: '4', patientName: 'João Almeida', appointmentType: 'Avaliação Inicial', time: '14:00' }
          ]}
        />

        <div className="grid gap-4 md:grid-cols-2">
          <InteractionsChart
            data={Array.isArray(metrics.dailyInteractions) ? metrics.dailyInteractions : []}
            labels={dailyLabels}
            title="Interações Diárias"
          />
          
          <InteractionsChart
            data={Array.isArray(metrics.weeklyInteractions) ? metrics.weeklyInteractions : []}
            labels={weeklyLabels}
            title="Interações Semanais"
          />
        </div>
      </div>
    );
  }
  
  return content;
}
