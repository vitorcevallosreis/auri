import { Database } from '@/database/types';

export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show' | 'rescheduled';
export type AppointmentType = 'individual' | 'group';

export interface Appointment {
  id: string;
  created_at: string;
  updated_at: string;
  company_id: string | null;
  professional_id: string;
  service_id: string;
  client_id: string | null;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  notes: string | null;
  location: string | null;
  appointment_type: AppointmentType | null;
  convenio_usado: string | null;
  valor_cobrado: number | null;
  cliente_nome: string | null;
  cliente_telefone: string | null;
  cliente_email: string | null;
  pesquisa: string | null;
  
  // Additional joined data
  professional_name?: string;
  service_name?: string;
}

export interface AppointmentFilters {
  professional_id?: string;
  service_id?: string;
  date?: Date;
  status?: AppointmentStatus;
  searchQuery?: string;
}

export interface AppointmentsContextType {
  appointments: Appointment[];
  isLoading: boolean;
  error: string | null;
  filters: AppointmentFilters;
  setFilters: (filters: AppointmentFilters) => void;
  fetchAppointments: () => Promise<void>;
  createAppointment: (appointment: Omit<Appointment, 'id' | 'created_at' | 'updated_at'>) => Promise<Appointment | null>;
  updateAppointment: (id: string, data: Partial<Appointment>) => Promise<Appointment | null>;
  deleteAppointment: (id: string) => Promise<boolean>;
  getAppointmentsByDay: (date: Date) => Appointment[];
  getAppointmentsByWeek: (startDate: Date) => Appointment[];
  clearFilters: () => void;
}

export type AppointmentsTableType = Database['public']['Tables']['myia_appointments']['Row'];
