'use client';

import React from 'react';
import { AgendaViewProps } from '@/types/calendar';
import { AppointmentCard } from '../cards/AppointmentCard';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getUniqueDatesFromAppointments } from '@/utils/dateUtils';

export function AgendaView({ appointments, onAppointmentClick }: AgendaViewProps) {
  const uniqueDates = getUniqueDatesFromAppointments(appointments);
  
  return (
    <div className="p-4">
      <ScrollArea className="h-[600px]">
        {appointments.length > 0 ? (
          <div className="space-y-8">
            {uniqueDates.map(date => {
              const dayAppointments = appointments.filter(app => app.appointment_date === date);
              const formattedDate = format(parseISO(date), "EEEE, dd 'de' MMMM", { locale: ptBR });
              const isToday = new Date().toISOString().split('T')[0] === date;
              
              return (
                <div key={date} className="space-y-4">
                  <h3 
                    className="text-lg font-medium sticky top-0 bg-card py-2 z-10"
                    aria-live="polite"
                  >
                    {isToday ? `Hoje (${format(parseISO(date), "EEEE, dd", { locale: ptBR })})` : formattedDate}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {dayAppointments
                      .sort((a, b) => a.start_time.localeCompare(b.start_time))
                      .map(appointment => (
                        <AppointmentCard
                          key={appointment.id}
                          appointment={appointment}
                          onClick={onAppointmentClick}
                        />
                      ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div 
            className="text-center py-8 text-muted-foreground"
            aria-live="polite"
          >
            Nenhum agendamento encontrado.
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
