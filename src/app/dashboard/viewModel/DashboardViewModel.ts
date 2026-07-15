import { create } from 'zustand';

interface Metrics {
  engagementRate: number;
  averageResponseTime: number;
  totalInteractions: number;
  dailyInteractions: number[];
  weeklyInteractions: number[];
}

interface DashboardState {
  metrics: Metrics;
  isLoading: boolean;
  error: string | null;
  fetchMetrics: () => Promise<void>;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  metrics: {
    engagementRate: 0,
    averageResponseTime: 0,
    totalInteractions: 0,
    dailyInteractions: [],
    weeklyInteractions: [],
  },
  isLoading: false,
  error: null,
  fetchMetrics: async () => {
    set({ isLoading: true });
    try {
      // TODO: Integrar com a API real
      // Simulando dados para demonstração
      const mockData: Metrics = {
        engagementRate: 85.5,
        averageResponseTime: 2.3,
        totalInteractions: 1234,
        dailyInteractions: [23, 45, 67, 89, 78, 56, 90],
        weeklyInteractions: [320, 450, 280, 390, 420],
      };
      
      set({ metrics: mockData, isLoading: false });
    } catch (error) {
      set({ error: 'Erro ao carregar métricas', isLoading: false });
    }
  },
}));
