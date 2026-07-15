import { Appointment } from '@/contexts/Appointments/interfaces';

export type CalendarView = 'day' | 'week' | 'month' | 'agenda';

export interface CalendarContainerProps {
  view: CalendarView;
  currentDate: Date;
  isLoading?: boolean;
  appointments?: Appointment[];
  onAppointmentClick?: (appointment: Appointment) => void;
  renderTitle?: boolean;
}

export interface CalendarViewProps {
  currentDate: Date;
  appointments: Appointment[];
  onAppointmentClick: (appointment: Appointment) => void;
}

export interface CalendarNavigationProps {
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
}

export interface CalendarViewSelectorProps {
  currentView: CalendarView;
  onViewChange: (view: CalendarView) => void;
}

export interface AppointmentCardProps {
  appointment: Appointment;
  onClick: (appointment: Appointment) => void;
  variant?: 'default' | 'compact' | 'minimal' | 'time-block';
}

export interface DayViewProps extends CalendarViewProps {}
export interface WeekViewProps extends CalendarViewProps {}
export interface MonthViewProps extends CalendarViewProps {}
export interface AgendaViewProps extends CalendarViewProps {}
