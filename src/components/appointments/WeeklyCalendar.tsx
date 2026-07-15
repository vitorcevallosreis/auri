'use client';

import React, { useState, useEffect } from 'react';
import { 
  format, startOfWeek, endOfWeek, eachDayOfInterval, 
  isToday, isSameDay, addWeeks, subWeeks, parseISO, isBefore, isAfter 
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAppointments } from '@/contexts/Appointments';
import { Appointment } from '@/contexts/Appointments/interfaces';
import { Button } from '@/components/ui/button';
import { 
  ChevronLeft, ChevronRight, Calendar as CalendarIcon,
  Clock, User, Bookmark, MapPin, AlertCircle 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const statusColorMap: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200',
  completed: 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200',
  cancelled: 'bg-red-100 text-red-800 border-red-300 hover:bg-red-200',
  no_show: 'bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-200',
  rescheduled: 'bg-purple-100 text-purple-800 border-purple-300 hover:bg-purple-200'
};

interface WeeklyCalendarProps {
  onAppointmentClick: (appointment: Appointment) => void;
  currentDate?: Date;
}

export const WeeklyCalendar = ({ onAppointmentClick, currentDate: propCurrentDate }: WeeklyCalendarProps) => {
  const [currentDate, setCurrentDate] = useState(propCurrentDate || new Date());
  const [currentWeek, setCurrentWeek] = useState<Date[]>([]);
  const { appointments, isLoading, fetchAppointments } = useAppointments();
  
  // Update currentDate when prop changes
  useEffect(() => {
    if (propCurrentDate) {
      setCurrentDate(propCurrentDate);
    }
  }, [propCurrentDate]);

  useEffect(() => {
    const startDate = startOfWeek(currentDate, { locale: ptBR });
    const endDate = endOfWeek(currentDate, { locale: ptBR });
    const weekDays = eachDayOfInterval({ start: startDate, end: endDate });
    setCurrentWeek(weekDays);
  }, [currentDate]);

  const goToPreviousWeek = () => {
    setCurrentDate(prevDate => subWeeks(prevDate, 1));
  };

  const goToNextWeek = () => {
    setCurrentDate(prevDate => addWeeks(prevDate, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getAppointmentsForDay = (day: Date) => {
    const formattedDay = format(day, 'yyyy-MM-dd');
    return appointments.filter(appointment => appointment.appointment_date === formattedDay)
      .sort((a, b) => {
        return a.start_time.localeCompare(b.start_time);
      });
  };

  const getAppointmentTimeRange = (appointment: Appointment) => {
    return `${appointment.start_time.substring(0, 5)} - ${appointment.end_time.substring(0, 5)}`;
  };

  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, string> = {
      scheduled: 'Agendado',
      completed: 'Concluído',
      cancelled: 'Cancelado',
      no_show: 'Não Compareceu',
      rescheduled: 'Reagendado'
    };
    return statusMap[status] || status;
  };

  const isPastAppointment = (appointmentDate: string, startTime: string) => {
    const appointmentDateTime = new Date(`${appointmentDate}T${startTime}`);
    return isBefore(appointmentDateTime, new Date());
  };

  return (
    <div className="border rounded-lg shadow-sm bg-white">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-xl font-semibold">Agenda Semanal</h2>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={goToPreviousWeek}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={goToToday}
          >
            Hoje
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={goToNextWeek}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b">
        {currentWeek.map((day, index) => (
          <div 
            key={index} 
            className={cn(
              "text-center py-3 font-medium px-2 border-r last:border-r-0",
              isToday(day) && "bg-blue-50"
            )}
          >
            <div className="text-sm text-gray-500 uppercase">
              {format(day, 'EEE', { locale: ptBR })}
            </div>
            <div className={cn(
              "mt-1 text-xl",
              isToday(day) && "text-blue-600 font-bold"
            )}>
              {format(day, 'd')}
            </div>
            <div className="text-xs text-gray-400">
              {format(day, 'MMM', { locale: ptBR })}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 h-[500px]">
        {currentWeek.map((day, index) => {
          const dayAppointments = getAppointmentsForDay(day);
          return (
            <div 
              key={index} 
              className={cn(
                "border-r last:border-r-0",
                isToday(day) && "bg-blue-50"
              )}
            >
              <ScrollArea className="h-[500px]">
                <div className="p-2 space-y-2">
                  {isLoading ? (
                    <div className="flex justify-center items-center h-16">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                    </div>
                  ) : dayAppointments.length === 0 ? (
                    <div className="text-center py-4 text-gray-400 text-sm">
                      Sem agendamentos
                    </div>
                  ) : (
                    dayAppointments.map(appointment => (
                      <TooltipProvider key={appointment.id}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div 
                              className={cn(
                                "p-2 rounded border cursor-pointer transition-colors text-left",
                                statusColorMap[appointment.status],
                                isPastAppointment(appointment.appointment_date, appointment.start_time) && "opacity-70"
                              )}
                              onClick={() => onAppointmentClick(appointment)}
                            >
                              <div className="flex items-center gap-1 text-xs font-medium mb-1">
                                <Clock className="h-3 w-3" /> 
                                {getAppointmentTimeRange(appointment)}
                              </div>
                              <div className="font-medium mb-1 truncate">
                                {appointment.cliente_nome || "Cliente não informado"}
                              </div>
                              <div className="flex items-center gap-1 text-xs text-gray-600 mb-1 truncate">
                                <User className="h-3 w-3" /> 
                                {appointment.professional_name}
                              </div>
                              <div className="flex items-center gap-1 text-xs text-gray-600 truncate">
                                <Bookmark className="h-3 w-3" /> 
                                {appointment.service_name}
                              </div>
                              <div className="mt-1">
                                <Badge variant="outline" className={cn("text-xs py-0 px-1", 
                                  appointment.status === 'scheduled' && "bg-blue-50 border-blue-200 text-blue-700",
                                  appointment.status === 'completed' && "bg-green-50 border-green-200 text-green-700",
                                  appointment.status === 'cancelled' && "bg-red-50 border-red-200 text-red-700",
                                  appointment.status === 'no_show' && "bg-yellow-50 border-yellow-200 text-yellow-700",
                                  appointment.status === 'rescheduled' && "bg-purple-50 border-purple-200 text-purple-700"
                                )}>
                                  {getStatusLabel(appointment.status)}
                                </Badge>
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="space-y-1 max-w-xs">
                              <div className="font-bold">{appointment.cliente_nome || "Cliente não informado"}</div>
                              <div className="flex items-center gap-1 text-xs">
                                <Clock className="h-3.5 w-3.5" />
                                {getAppointmentTimeRange(appointment)}
                              </div>
                              <div className="flex items-center gap-1 text-xs">
                                <User className="h-3.5 w-3.5" />
                                {appointment.professional_name}
                              </div>
                              <div className="flex items-center gap-1 text-xs">
                                <Bookmark className="h-3.5 w-3.5" />
                                {appointment.service_name}
                              </div>
                              {appointment.location && (
                                <div className="flex items-center gap-1 text-xs">
                                  <MapPin className="h-3.5 w-3.5" />
                                  {appointment.location}
                                </div>
                              )}
                              {appointment.notes && (
                                <div className="flex items-center gap-1 text-xs">
                                  <AlertCircle className="h-3.5 w-3.5" />
                                  {appointment.notes}
                                </div>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          );
        })}
      </div>
    </div>
  );
};
