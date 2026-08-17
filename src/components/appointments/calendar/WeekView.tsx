'use client';

import React, { useEffect, useRef } from 'react';
import { WeekViewProps } from '@/types/calendar';
import { AppointmentCard } from '../cards/AppointmentCard';
import { format, isToday, parseISO, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getDaysInWeek, getAppointmentsForDay } from '@/utils/dateUtils';

// Horários para o dia completo (00h às 23h)
const BUSINESS_HOURS = {
  start: 0,
  end: 24
};

// Altura de cada hora em pixels
const HOUR_HEIGHT = 60;

export function WeekView({ currentDate, appointments, onAppointmentClick }: WeekViewProps) {
  const weekDays = getDaysInWeek(currentDate);
  
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
  const getAppointmentStyle = (appointment: any, dayIndex: number) => {
    const startTime = parseISO(`2000-01-01T${appointment.start_time}`);
    const endTime = parseISO(`2000-01-01T${appointment.end_time}`);
    
    // Calcula a posição vertical (top) baseada na hora de início
    const startHour = startTime.getHours();
    const startMinute = startTime.getMinutes();
    const startPosition = (startHour - BUSINESS_HOURS.start) * HOUR_HEIGHT + (startMinute / 60) * HOUR_HEIGHT;
    
    // Calcula a altura baseada na duração
    const durationMinutes = differenceInMinutes(endTime, startTime);
    const height = (durationMinutes / 60) * HOUR_HEIGHT;
    
    // Calcula a largura e posição horizontal com base no dia da semana
    const width = `calc(100% - 8px)`;
    
    return {
      top: `${startPosition}px`,
      height: `${height}px`,
      width,
      position: 'absolute' as 'absolute',
      left: '4px',
      zIndex: 10
    };
  };
  
  return (
    <div className="flex flex-col">
      {/* Cabeçalho dos dias da semana */}
      <div className="flex border-b">
        {/* Espaço para alinhar com a coluna de horários */}
        <div className="w-16"></div>
        
        {/* Dias da semana */}
        <div className="flex-1 grid grid-cols-7 gap-2 p-2">
          {weekDays.map((day, index) => {
            const isCurrentDay = isToday(day);
            
            return (
              <div 
                key={`header-${index}`} 
                className={cn(
                  "text-center p-2 font-medium text-sm",
                  isCurrentDay && "bg-accent/20 text-foreground rounded-md"
                )}
                aria-live={isCurrentDay ? "polite" : "off"}
              >
                <div className="uppercase">{format(day, 'EEEE', { locale: ptBR })}</div>
                <div className={cn(
                  "text-lg mt-1",
                  isCurrentDay && "font-bold text-primary"
                )}>
                  {format(day, 'd')}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Grade de horários com agendamentos */}
      <ScrollArea ref={scrollRef} className="h-[calc(100vh-220px)]" type="always">
        <div className="relative pt-4" style={{ height: `${hours.length * HOUR_HEIGHT + 16}px` }}>
          {/* Linhas de hora */}
          {hours.map((hour) => (
            <div 
              key={`hour-${hour}`} 
              className="absolute w-full border-t border-border flex"
              style={{ top: `${(hour - BUSINESS_HOURS.start) * HOUR_HEIGHT + 16}px` }}
            >
              <div className="w-16 pr-2 text-right text-sm text-muted-foreground -mt-3">
                {hour}:00
              </div>
              <div className="flex-1 grid grid-cols-7 gap-2">
                {weekDays.map((_, dayIndex) => (
                  <div 
                    key={`hour-${hour}-day-${dayIndex}`} 
                    className="border-l border-border h-full"
                  />
                ))}
              </div>
            </div>
          ))}
          
          {/* Agendamentos por dia */}
          <div className="absolute top-4 left-16 right-0 h-full grid grid-cols-7 gap-2">
            {weekDays.map((day, dayIndex) => {
              const dayAppointments = getAppointmentsForDay(appointments, day);
              
              return (
                <div key={`appointments-${dayIndex}`} className="relative h-full">
                  {dayAppointments.length > 0 ? (
                    dayAppointments.map(appointment => (
                      <div 
                        key={appointment.id} 
                        style={getAppointmentStyle(appointment, dayIndex)}
                        className="overflow-visible"
                      >
                        <AppointmentCard
                          appointment={appointment}
                          onClick={onAppointmentClick}
                          variant="time-block"
                        />
                      </div>
                    ))
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
