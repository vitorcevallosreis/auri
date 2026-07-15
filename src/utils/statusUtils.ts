import { AppointmentStatus } from '@/contexts/Appointments/interfaces';

// Mapeamento de cores para cada status
export const statusColorMap: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-800 border-blue-300",     // agendado
  completed: "bg-green-100 text-green-800 border-green-300",  // concluído
  cancelled: "bg-red-100 text-red-800 border-red-300",        // cancelado
  no_show: "bg-gray-100 text-gray-800 border-gray-300",       // não compareceu
  rescheduled: "bg-yellow-100 text-yellow-800 border-yellow-300" // reagendado
};

// Função para obter rótulo legível do status em português
export const getStatusLabel = (status: AppointmentStatus): string => {
  const statusLabels: Record<AppointmentStatus, string> = {
    scheduled: "Agendado",
    completed: "Concluído",
    cancelled: "Cancelado",
    no_show: "Não Compareceu",
    rescheduled: "Reagendado"
  };
  return statusLabels[status] || status.toString();
};

// Função para obter a cor do badge baseado no status
export const getStatusBadgeClass = (status: AppointmentStatus): string => {
  const badgeClasses: Record<AppointmentStatus, string> = {
    scheduled: "bg-blue-50 border-blue-200 text-blue-700",
    completed: "bg-green-50 border-green-200 text-green-700",
    cancelled: "bg-red-50 border-red-200 text-red-700",
    no_show: "bg-yellow-50 border-yellow-200 text-yellow-700",
    rescheduled: "bg-purple-50 border-purple-200 text-purple-700"
  };
  return badgeClasses[status] || "";
};
