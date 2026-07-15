import { 
  format, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isToday, 
  parseISO,
  isWithinInterval
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Appointment } from '@/contexts/Appointments/interfaces';

/**
 * Formats a date to display in the calendar title based on the view type
 */
export const formatDateForTitle = (date: Date, view: 'day' | 'week' | 'month' | 'agenda'): string => {
  switch (view) {
    case 'day':
      return format(date, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
    case 'week':
      return `${format(startOfWeek(date, { locale: ptBR }), "d 'de' MMMM", { locale: ptBR })} - ${format(endOfWeek(date, { locale: ptBR }), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}`;
    case 'month':
      return format(date, "MMMM 'de' yyyy", { locale: ptBR });
    case 'agenda':
      return 'Visualização de Agenda';
    default:
      return format(date, 'PPP', { locale: ptBR });
  }
};

/**
 * Gets the days of a month for the month view
 */
export const getDaysInMonth = (date: Date): Date[] => {
  return eachDayOfInterval({
    start: startOfMonth(date),
    end: endOfMonth(date)
  });
};

/**
 * Gets the days of a week for the week view
 */
export const getDaysInWeek = (date: Date): Date[] => {
  return eachDayOfInterval({
    start: startOfWeek(date, { locale: ptBR }),
    end: endOfWeek(date, { locale: ptBR })
  });
};

/**
 * Formats a time string from "HH:MM:SS" to "HH:MM"
 */
export const formatTime = (time: string): string => {
  return time.substring(0, 5);
};

/**
 * Gets a time range string from start and end times
 */
export const getTimeRange = (startTime: string, endTime: string): string => {
  return `${formatTime(startTime)} - ${formatTime(endTime)}`;
};

/**
 * Filters appointments for a specific day
 */
export const getAppointmentsForDay = (appointments: Appointment[], date: Date): Appointment[] => {
  const formattedDate = format(date, 'yyyy-MM-dd');
  return appointments
    .filter(app => app.appointment_date === formattedDate)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
};

/**
 * Filters appointments for a specific week
 */
export const getAppointmentsForWeek = (appointments: Appointment[], date: Date): Appointment[] => {
  const start = startOfWeek(date, { locale: ptBR });
  const end = endOfWeek(date, { locale: ptBR });
  
  return appointments.filter(appointment => {
    const appointmentDate = parseISO(appointment.appointment_date);
    return isWithinInterval(appointmentDate, { start, end });
  });
};

/**
 * Checks if an appointment is in the past
 */
export const isPastAppointment = (appointmentDate: string, startTime: string): boolean => {
  const appointmentDateTime = new Date(`${appointmentDate}T${startTime}`);
  return appointmentDateTime < new Date();
};

/**
 * Gets all unique dates from appointments sorted chronologically
 */
export const getUniqueDatesFromAppointments = (appointments: Appointment[]): string[] => {
  return Array.from(new Set(appointments.map(app => app.appointment_date)))
    .sort();
};
