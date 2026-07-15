'use client';

import React from 'react';
import { MonthViewProps } from '@/types/calendar';
import { AppointmentCard } from '../cards/AppointmentCard';
import { format, isSameMonth, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getDaysInMonth, getAppointmentsForDay } from '@/utils/dateUtils';

export function MonthView({ currentDate, appointments, onAppointmentClick }: MonthViewProps) {
  const days = getDaysInMonth(currentDate);
  
  const handleDayClick = (day: Date) => {
    // This could be used in the future to navigate to day view
    // Currently not implemented as we need to coordinate with the parent component
  };
  
  return (
    <div className="p-4">
      <div className="grid grid-cols-7 gap-1">
        {/* Day names header */}
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
          <div 
            key={day} 
            className="text-center font-medium text-sm py-2"
            aria-hidden="true"
          >
            {day}
          </div>
        ))}
        
        {/* Calendar days */}
        {days.map((day, i) => {
          const dayAppointments = getAppointmentsForDay(appointments, day);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isCurrentDay = isToday(day);
          
          return (
            <div 
              key={i}
              className={cn(
                "min-h-[100px] border rounded-md p-1",
                !isCurrentMonth && "bg-gray-50 opacity-50",
                isCurrentDay && "border-[#00897B]"
              )}
              onClick={() => handleDayClick(day)}
              role="button"
              aria-label={format(day, "d 'de' MMMM", { locale: ptBR })}
            >
              <div 
                className={cn(
                  "text-right text-sm p-1 font-medium",
                  isCurrentDay && "text-[#00897B]"
                )}
                aria-hidden="true"
              >
                {format(day, 'd')}
              </div>
              
              <ScrollArea className="h-[80px]">
                <div className="space-y-1">
                  {dayAppointments.slice(0, 3).map(app => (
                    <AppointmentCard
                      key={app.id}
                      appointment={app}
                      onClick={(e) => {
                        // Stop propagation to prevent day click
                        onAppointmentClick(app);
                      }}
                      variant="minimal"
                    />
                  ))}
                  
                  {dayAppointments.length > 3 && (
                    <div 
                      className="text-xs text-center text-muted-foreground"
                      aria-label={`Mais ${dayAppointments.length - 3} agendamentos`}
                    >
                      +{dayAppointments.length - 3} mais
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          );
        })}
      </div>
    </div>
  );
}
