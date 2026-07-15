import { api } from '@/lib/webhooks/api';

interface DashboardMetrics {
  totalAppointments: number;
  upcomingAppointments: number;
  totalInteractions: number;
  engagementRate: number;
  averageResponseTime: number;
  dailyInteractions: number[];
  weeklyInteractions: number[];
  interactionsData?: {
    labels: string[];
    data: number[];
  };
}

/**
 * Fetches dashboard metrics for the specified company
 * @param companyId The ID of the company to fetch metrics for
 * @returns Dashboard metrics data
 */
export async function fetchDashboardMetrics(companyId: string): Promise<DashboardMetrics> {
  try {
    const response = await api.get(`/dashboard/metrics/${companyId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching dashboard metrics:', error);
    
    // Return default data in case of error
    return {
      totalAppointments: 0,
      upcomingAppointments: 0,
      totalInteractions: 0,
      engagementRate: 0,
      averageResponseTime: 0,
      dailyInteractions: [],
      weeklyInteractions: [],
      interactionsData: {
        labels: [],
        data: [],
      }
    };
  }
}
