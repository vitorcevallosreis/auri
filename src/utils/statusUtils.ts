import { AppointmentStatus } from '@/contexts/Appointments/interfaces';

// Mapeamento de cores para cada status
export const statusColorMap: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30",     // agendado
  completed: "bg-green-100 text-green-800 border-green-300 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/30",  // concluído
  cancelled: "bg-red-100 text-red-800 border-red-300 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30",        // cancelado
  no_show: "bg-muted text-foreground border-border",       // não compareceu
  rescheduled: "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-500/15 dark:text-yellow-300 dark:border-yellow-500/30" // reagendado
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
    scheduled: "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-500/10 dark:border-blue-500/30 dark:text-blue-300",
    completed: "bg-green-50 border-green-200 text-green-700 dark:bg-green-500/10 dark:border-green-500/30 dark:text-green-300",
    cancelled: "bg-red-50 border-red-200 text-red-700 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300",
    no_show: "bg-yellow-50 border-yellow-200 text-yellow-700 dark:bg-yellow-500/10 dark:border-yellow-500/30 dark:text-yellow-300",
    rescheduled: "bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-500/10 dark:border-purple-500/30 dark:text-purple-300"
  };
  return badgeClasses[status] || "";
};
