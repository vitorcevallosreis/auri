'use client';

import React from 'react';
import { Appointment } from '@/contexts/Appointments/interfaces';
import { Badge } from '@/components/ui/badge';
import { User, Bookmark, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { statusColorMap, getStatusLabel } from '@/utils/statusUtils';
import { formatTime } from '@/utils/dateUtils';
import { AppointmentCardProps } from '@/types/calendar';
import { parseISO, format as formatDate } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export function AppointmentCard({ 
  appointment, 
  onClick, 
  variant = 'default' 
}: AppointmentCardProps) {
  const handleClick = () => {
    onClick(appointment);
  };

  // Minimal variant (used in month view)
  if (variant === 'minimal') {
    return (
      <div 
        className={cn(
          "text-xs p-1 rounded truncate cursor-pointer transition-colors",
          statusColorMap[appointment.status]
        )}
        onClick={handleClick}
        role="button"
        aria-label={`Agendamento de ${appointment.cliente_nome || "Cliente não informado"}`}
      >
        {formatTime(appointment.start_time)} - {appointment.cliente_nome || "Cliente"}
      </div>
    );
  }

  // Compact variant (used in week view)
  if (variant === 'compact') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div 
              className={cn(
                "p-2 rounded-md border text-sm cursor-pointer transition-colors hover:opacity-90",
                statusColorMap[appointment.status]
              )}
              onClick={handleClick}
              role="button"
              aria-label={`Agendamento de ${appointment.cliente_nome || "Cliente não informado"}`}
            >
              <div className="font-medium truncate">
                {appointment.cliente_nome || "Cliente não informado"}
              </div>
              <div className="flex items-center gap-1 text-xs">
                <Clock className="h-3 w-3" aria-hidden="true" /> 
                {formatTime(appointment.start_time)} - {formatTime(appointment.end_time)}
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1 max-w-xs">
              <div className="font-bold">{appointment.cliente_nome || "Cliente não informado"}</div>
              <div className="flex items-center gap-1 text-xs">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                {formatTime(appointment.start_time)} - {formatTime(appointment.end_time)}
              </div>
              <div className="flex items-center gap-1 text-xs">
                <User className="h-3.5 w-3.5" aria-hidden="true" />
                {appointment.professional_name}
              </div>
              <div className="flex items-center gap-1 text-xs">
                <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />
                {appointment.service_name}
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Time-block variant (used in time-based day view)
  if (variant === 'time-block') {
    return (
      <div 
        className={cn(
          "h-full w-full rounded-md border shadow-sm cursor-pointer transition-colors hover:opacity-90 overflow-hidden",
          statusColorMap[appointment.status]
        )}
        onClick={handleClick}
        role="button"
        aria-label={`Agendamento de ${appointment.cliente_nome || "Cliente não informado"} às ${formatTime(appointment.start_time)}`}
      >
        <div className="p-2 h-full flex flex-col">
          <div className="font-medium truncate text-sm">
            {appointment.cliente_nome || "Cliente não informado"}
          </div>
          <div className="text-xs flex items-center">
            <Clock className="h-3 w-3 mr-1" aria-hidden="true" />
            {formatTime(appointment.start_time)} - {formatTime(appointment.end_time)}
          </div>
          <div className="text-xs flex items-center mt-auto">
            <User className="h-3 w-3 mr-1" aria-hidden="true" />
            <span className="truncate">{appointment.professional_name}</span>
          </div>
          <div className="text-xs flex items-center">
            <Bookmark className="h-3 w-3 mr-1" aria-hidden="true" />
            <span className="truncate">{appointment.service_name}</span>
          </div>
        </div>
      </div>
    );
  }
  
  // Default variant (used in day and agenda views)
  return (
    <div 
      className="bg-card rounded-lg border border-border shadow-sm cursor-pointer transition-all hover:shadow-md w-full"
      onClick={handleClick}
      role="button"
      aria-label={`Agendamento de ${appointment.cliente_nome || "Cliente não informado"}`}
    >
      <div className="p-4">
        <div className="flex justify-between items-center mb-2">
          <div>
            <h3 className="font-medium text-base">{appointment.cliente_nome || "Cliente não informado"}</h3>
            <p className="text-sm text-muted-foreground">{appointment.service_name}</p>
          </div>
          <Badge 
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium",
              appointment.status === 'scheduled' ? "bg-blue-50 text-blue-700" :
              appointment.status === 'completed' ? "bg-green-50 text-green-700" :
              appointment.status === 'cancelled' ? "bg-red-50 text-red-700" :
              "bg-yellow-50 text-yellow-700"
            )}
          >
            {appointment.status === 'scheduled' ? "Agendado" :
             appointment.status === 'completed' ? "Concluído" :
             appointment.status === 'cancelled' ? "Cancelado" :
             appointment.status === 'no_show' ? "Pendente" : getStatusLabel(appointment.status)}
          </Badge>
        </div>
        
        <div className="flex items-center mt-3">
          <Clock className="h-4 w-4 text-teal-500 mr-2" aria-hidden="true" />
          <span className="text-sm font-medium text-foreground">{formatTime(appointment.start_time)} - {formatTime(appointment.end_time)}</span>
        </div>
        
        <div className="flex items-center mt-2">
          <User className="h-4 w-4 text-muted-foreground mr-2" aria-hidden="true" />
          <span className="text-sm text-muted-foreground">{appointment.professional_name}</span>
        </div>
      </div>
    </div>
  );
}
