'use client';

import React, { useEffect, useRef } from 'react';
import { DayViewProps } from '@/types/calendar';
import { AppointmentCard } from '../cards/AppointmentCard';
import { format, parseISO, addHours, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getAppointmentsForDay } from '@/utils/dateUtils';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

// Horários para o dia completo (00h às 23h)
const BUSINESS_HOURS = {
  start: 0,
  end: 24
};

// Altura de cada hora em pixels
const HOUR_HEIGHT = 60;

export function DayView({ currentDate, appointments, onAppointmentClick }: DayViewProps) {
  const dayAppointments = getAppointmentsForDay(appointments, currentDate);
  
  // Gera as horas do dia para a visualização
  const hours = Array.from({ length: BUSINESS_HOURS.end - BUSINESS_HOURS.start }, (_, i) => BUSINESS_HOURS.start + i);

  // A grade cobre 24h para não esconder agendamentos fora do horário comercial
  // (uma clínica pode ter encaixe às 6h). Mas abrir a agenda na madrugada vazia
  // é ruim: aqui rolamos até as 7h na montagem, sem remover nada.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const viewport = scrollRef.current?.querySelector<HTMLElement>(
      "[data-radix-scroll-area-viewport]",
    );
    if (viewport) {
      viewport.scrollTop = (7 - BUSINESS_HOURS.start) * HOUR_HEIGHT;
    }
  }, []);

  
  // Calcula a posição e altura de cada agendamento com base no horário
  const getAppointmentStyle = (appointment: any) => {
    const startTime = parseISO(`2000-01-01T${appointment.start_time}`);
    const endTime = parseISO(`2000-01-01T${appointment.end_time}`);
    
    // Calcula a posição vertical (top) baseada na hora de início
    const startHour = startTime.getHours();
    const startMinute = startTime.getMinutes();
    const startPosition = (startHour - BUSINESS_HOURS.start) * HOUR_HEIGHT + (startMinute / 60) * HOUR_HEIGHT;
    
    // Calcula a altura baseada na duração
    const durationMinutes = differenceInMinutes(endTime, startTime);
    const height = (durationMinutes / 60) * HOUR_HEIGHT;
    
    return {
      top: `${startPosition}px`,
      height: `${height}px`,
      position: 'absolute' as 'absolute',
      width: 'calc(100% - 80px)',
      left: '70px',
      zIndex: 10
    };
  };
  
  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-4" aria-live="polite">
        {format(currentDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
      </h3>
      
      <ScrollArea ref={scrollRef} className="h-[calc(100vh-220px)]" type="always">
        <div className="relative pt-4" style={{ height: `${hours.length * HOUR_HEIGHT + 16}px` }}>
          {/* Linhas de hora */}
          {hours.map((hour) => (
            <div 
              key={hour} 
              className="absolute w-full border-t border-border flex"
              style={{ top: `${(hour - BUSINESS_HOURS.start) * HOUR_HEIGHT + 16}px` }}
            >
              <div className="w-16 pr-2 text-right text-sm text-muted-foreground -mt-3">
                {hour}:00
              </div>
              <div className="flex-1"></div>
            </div>
          ))}
          
          {/* Agendamentos */}
          {dayAppointments.length > 0 ? (
            dayAppointments.map(appointment => {
              // Ajusta o estilo para incluir o espaçamento superior
              const style = getAppointmentStyle(appointment);
              const top = parseInt(style.top.replace('px', ''));
              style.top = `${top + 16}px`;
              
              return (
                <div 
                  key={appointment.id} 
                  style={style}
                  className="overflow-visible"
                >
                  <AppointmentCard
                    appointment={appointment}
                    onClick={onAppointmentClick}
                    variant="time-block"
                  />
                </div>
              );
            })
          ) : (
            <div 
              className="absolute inset-0 flex items-center justify-center text-muted-foreground"
              aria-live="polite"
            >
              Nenhum agendamento para este dia.
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
