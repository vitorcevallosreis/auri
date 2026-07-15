'use client';

import React, { useState, useEffect } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { format, parse, isAfter, isBefore, addMinutes, startOfDay, endOfDay, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/lib/supabase/config';
import { AppointmentFormData } from '..';
import { cn } from '@/lib/utils';
import { Clock, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';

interface Availability {
  id: string;
  professional_id: string;
  day_of_week: number;
  opening_time: string;
  closing_time: string;
  is_available: boolean;
  service_id: string | null;
}

interface Appointment {
  id: string;
  professional_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
}

interface TimeSlot {
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

interface DateTimeStepProps {
  formData: AppointmentFormData & {
    dateTimeConflicts?: Array<{
      dataFormatada: string;
      horaInicio: string;
      horaFim: string;
    }>;
  };
  updateFormData: (data: Partial<AppointmentFormData>) => void;
  isEdit: boolean;
}

export const DateTimeStep: React.FC<DateTimeStepProps> = ({
  formData,
  updateFormData,
  isEdit
}) => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(formData.dateTime.date || undefined);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [calendarDays, setCalendarDays] = useState<(Date | null)[]>([]);
  const [availabilityData, setAvailabilityData] = useState<Availability[]>([]);
  const [existingAppointments, setExistingAppointments] = useState<Appointment[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot | null>(
    formData.dateTime.startTime && formData.dateTime.endTime 
      ? { 
          startTime: formData.dateTime.startTime, 
          endTime: formData.dateTime.endTime, 
          isAvailable: true 
        } 
      : null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [availableDates, setAvailableDates] = useState<Date[]>([]);

  // Gerar dias do calendário para o mês atual
  useEffect(() => {
    const days: (Date | null)[] = [];
    
    // Obter o primeiro dia do mês
    const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    
    // Obter o último dia do mês
    const lastDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    
    // Obter o dia da semana do primeiro dia do mês (0 = domingo, 1 = segunda, ...)
    const firstDayOfWeek = firstDayOfMonth.getDay();
    
    // Preencher os dias vazios antes do primeiro dia do mês
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(null);
    }
    
    // Preencher os dias do mês
    for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
      days.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i));
    }
    
    // Preencher os dias vazios após o último dia do mês para completar a grade
    const remainingDays = 7 - (days.length % 7);
    if (remainingDays < 7) {
      for (let i = 0; i < remainingDays; i++) {
        days.push(null);
      }
    }
    
    setCalendarDays(days);
  }, [currentMonth]);
  
  // Buscar disponibilidade do profissional
  useEffect(() => {
    const fetchAvailability = async () => {
      if (!formData.professional.id) return;
      
      setIsLoading(true);
      try {
        // Buscar configurações de disponibilidade do profissional
        const { data, error } = await supabase
          .from('myia_professional_search_view')
          .select('day_of_week, opening_time, closing_time, service_id')
          .eq('id', formData.professional.id);

        console.log('Disponibilidade retornada pela view:', data);

        let filteredData = data || [];
        if (formData.service.id) {
          const specific = filteredData.filter(a => a.service_id === formData.service.id);
          filteredData = specific.length > 0
            ? specific
            : filteredData.filter(a => a.service_id === null);
        }
        
        if (error) {
          throw error;
        }
        
        // Filtrar por serviço se estiver selecionado
        if (formData.service.id) {
          // Primeiro tentamos encontrar disponibilidade específica para o serviço
          const serviceSpecific = filteredData.filter(
            a => a.service_id === formData.service.id
          );
          
          // Se encontrarmos, usamos apenas essas
          if (serviceSpecific.length > 0) {
            filteredData = serviceSpecific;
          } else {
            // Caso contrário, usamos as disponibilidades gerais (sem serviço específico)
            filteredData = filteredData.filter(a => a.service_id === null);
          }
        }
        
        // Corrigir tipagem: preencher campos faltantes para interface Availability
        setAvailabilityData(filteredData.map((a: any, idx: number) => ({
          id: a.id || String(idx),
          professional_id: formData.professional.id,
          day_of_week: a.day_of_week,
          opening_time: a.opening_time,
          closing_time: a.closing_time,
          is_available: true,
          service_id: a.service_id || null
        })));

        
        // Gerar datas disponíveis para o calendário
        const today = new Date();
        const dates: Date[] = [];
        
        // Considerar os próximos 60 dias
        for (let i = 0; i < 60; i++) {
          const date = new Date();
          date.setDate(today.getDate() + i);
          
          // Verificar se o profissional trabalha neste dia da semana
          const dayOfWeek = date.getDay(); // 0 = domingo, 1 = segunda, ...
          const hasAvailability = filteredData.some(a => a.day_of_week === dayOfWeek);
          
          if (hasAvailability) {
            dates.push(date);
          }
        }
        
        setAvailableDates(dates);
        
      } catch (error) {
        console.error('Erro ao buscar disponibilidade:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchAvailability();
  }, [formData.professional.id, formData.service.id]);

  // Buscar agendamentos existentes para a data selecionada
  useEffect(() => {
    const fetchExistingAppointments = async () => {
      if (!formData.professional.id || !selectedDate) return;
      
      setIsLoading(true);
      try {
        const formattedDate = format(selectedDate, 'yyyy-MM-dd');
        
        const { data, error } = await supabase
          .from('myia_appointments')
          .select('id, professional_id, appointment_date, start_time, end_time')
          .eq('professional_id', formData.professional.id)
          .eq('appointment_date', formattedDate);
        
        if (error) {
          throw error;
        }
        
        // Se estamos editando um agendamento, removemos ele da lista
        // para não bloquear seu próprio horário
        let appointments = data || [];
        if (isEdit && formData.dateTime.date) {
          appointments = appointments.filter(a => {
            // Se o agendamento sendo editado já tem um ID, podemos filtrar diretamente
            if (a.id === formData.dateTime.startTime) return false;
            
            // Caso contrário, verificamos pela data e horário
            const sameDate = a.appointment_date === (formData.dateTime.date ? format(formData.dateTime.date, 'yyyy-MM-dd') : '');
            const sameTime = a.start_time === formData.dateTime.startTime && 
                            a.end_time === formData.dateTime.endTime;
            
            return !(sameDate && sameTime);
          });
        }
        
        setExistingAppointments(appointments);
        
      } catch (error) {
        console.error('Erro ao buscar agendamentos existentes:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchExistingAppointments();
  }, [formData.professional.id, selectedDate, isEdit, formData.dateTime]);

  // Gerar slots de horário disponíveis
  useEffect(() => {
    if (!selectedDate || !formData.professional.id) return;
    
    // Obter dia da semana (0 = domingo, 1 = segunda, ...)
    const dayOfWeek = selectedDate.getDay();
    
    // Encontrar configuração de disponibilidade para este dia
    const availability = availabilityData.find(a => a.day_of_week === dayOfWeek);
    
    if (!availability) {
      setTimeSlots([]);
      return;
    }
    
    // Duração do serviço em minutos (padrão: 60 minutos)
    const serviceDuration = formData.service.duration || 60;
    
    // Gerar slots de horário
    const slots: TimeSlot[] = [];
    
    // Converter horários de string para Date
    try {
      // Usar a data atual apenas para a hora, não para o dia
      const baseDate = new Date();
      const openingTime = parse(availability.opening_time, 'HH:mm:ss', baseDate);
      const closingTime = parse(availability.closing_time, 'HH:mm:ss', baseDate);
      
      console.log('Horário de abertura:', format(openingTime, 'HH:mm:ss'));
      console.log('Horário de fechamento:', format(closingTime, 'HH:mm:ss'));
      
      // Gerar slots com intervalo igual à duração do serviço
      let currentTime = openingTime;
      while (isBefore(currentTime, closingTime)) {
        const endTime = addMinutes(currentTime, serviceDuration);
        
        // Verificar se o slot termina antes ou no horário de fechamento
        if (isBefore(endTime, closingTime) || format(endTime, 'HH:mm:ss') === format(closingTime, 'HH:mm:ss')) {
          const startTimeStr = format(currentTime, 'HH:mm:ss');
          const endTimeStr = format(endTime, 'HH:mm:ss');
          
          console.log('Verificando slot:', startTimeStr, '-', endTimeStr);
          
          // Verificar se o slot está disponível (não conflita com agendamentos existentes)
          let isAvailable = true;
          
          for (const appointment of existingAppointments) {
            const appointmentStart = parse(appointment.start_time, 'HH:mm:ss', baseDate);
            const appointmentEnd = parse(appointment.end_time, 'HH:mm:ss', baseDate);
            
            // Verifica se há sobreposição
            const hasOverlap = (
              (isBefore(currentTime, appointmentEnd) && isAfter(endTime, appointmentStart)) ||
              format(currentTime, 'HH:mm:ss') === format(appointmentStart, 'HH:mm:ss') ||
              format(endTime, 'HH:mm:ss') === format(appointmentEnd, 'HH:mm:ss')
            );
            
            if (hasOverlap) {
              console.log('Conflito com agendamento existente:', appointment.start_time, '-', appointment.end_time);
              isAvailable = false;
              break;
            }
          }
          
          slots.push({
            startTime: startTimeStr,
            endTime: endTimeStr,
            isAvailable
          });
          
          console.log('Slot adicionado:', startTimeStr, '-', endTimeStr, isAvailable ? '(disponível)' : '(indisponível)');
        }
        
        // Avançar para o próximo slot
        currentTime = addMinutes(currentTime, serviceDuration);
      }
    } catch (error) {
      console.error('Erro ao gerar slots de horário:', error);
    }
    
    console.log('Total de slots gerados:', slots.length);
    setTimeSlots(slots);
    
  }, [selectedDate, availabilityData, existingAppointments, formData.service.duration, formData.professional.id, formData.service.id]);

  // Atualizar dados do formulário quando a data ou horário selecionado mudar
  useEffect(() => {
    if (selectedDate && selectedTimeSlot) {
      // Verificar se os dados realmente mudaram antes de atualizar
      const dateChanged = !formData.dateTime.date || 
                          selectedDate.getTime() !== formData.dateTime.date.getTime();
      const timeChanged = selectedTimeSlot.startTime !== formData.dateTime.startTime || 
                          selectedTimeSlot.endTime !== formData.dateTime.endTime;
      
      if (dateChanged || timeChanged) {
        updateFormData({
          dateTime: {
            date: selectedDate,
            startTime: selectedTimeSlot.startTime,
            endTime: selectedTimeSlot.endTime
          }
        });
      }
    }
  }, [selectedDate, selectedTimeSlot, updateFormData, formData.dateTime]);

  const handleDateSelect = (date: Date | undefined) => {
    console.log('Data selecionada:', date);
    if (date) {
      setSelectedDate(date);
      setSelectedTimeSlot(null);
      
      // Forçar a busca de agendamentos existentes para a nova data
      const fetchAppointmentsForDate = async () => {
        if (!formData.professional.id) return;
        
        setIsLoading(true);
        try {
          const formattedDate = format(date, 'yyyy-MM-dd');
          
          const { data, error } = await supabase
            .from('myia_appointments')
            .select('id, professional_id, appointment_date, start_time, end_time')
            .eq('professional_id', formData.professional.id)
            .eq('appointment_date', formattedDate);
          
          if (error) {
            throw error;
          }
          
          setExistingAppointments(data || []);
        } catch (error) {
          console.error('Erro ao buscar agendamentos:', error);
        } finally {
          setIsLoading(false);
        }
      };
      
      fetchAppointmentsForDate();
    }
  };

  const handleTimeSlotSelect = (slot: TimeSlot) => {
    if (slot.isAvailable) {
      setSelectedTimeSlot(slot);
    }
  };

  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(':');
    return `${hours}:${minutes}`;
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
            <div className="bg-blue-50 p-4 border-b">
              <h3 className="text-base font-medium text-blue-700 flex items-center">
                <CalendarIcon className="mr-2 h-5 w-5" />
                Selecione uma data
              </h3>
            </div>
            <div className="p-4">
              <div className="space-y-4">
                {/* Seletor de mês */}
                <div className="flex justify-between items-center">
                  <button 
                    type="button"
                    className="p-2 rounded-md border hover:bg-gray-50"
                    onClick={() => {
                      const newDate = new Date();
                      newDate.setMonth(new Date().getMonth() - 1);
                      setCurrentMonth(newDate);
                    }}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <h3 className="font-medium">
                    {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                  </h3>
                  <button 
                    type="button"
                    className="p-2 rounded-md border hover:bg-gray-50"
                    onClick={() => {
                      const newDate = new Date(currentMonth);
                      newDate.setMonth(newDate.getMonth() + 1);
                      setCurrentMonth(newDate);
                    }}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                
                {/* Grade de dias */}
                <div className="grid grid-cols-7 gap-1">
                  {/* Cabeçalho com dias da semana */}
                  {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, index) => (
                    <div key={index} className="text-center text-gray-500 text-sm py-1">
                      {day}
                    </div>
                  ))}
                  
                  {/* Dias do mês atual */}
                  {calendarDays.map((day, index) => {
                    // Verificar se o dia está disponível
                    const isAvailable = availableDates.some(availableDate => 
                      day && isSameDay(day, availableDate)
                    );
                    
                    // Verificar se o dia está no passado
                    const isPast = day ? isBefore(day, startOfDay(new Date())) : false;
                    
                    // Verificar se o dia está selecionado
                    const isSelected = day && selectedDate ? isSameDay(day, selectedDate) : false;
                    
                    // Verificar se o dia é do mês atual
                    const isCurrentMonth = day ? day.getMonth() === currentMonth.getMonth() : false;
                    
                    return (
                      <button
                        key={index}
                        type="button"
                        disabled={!day || !isAvailable || isPast || !isCurrentMonth}
                        className={cn(
                          "h-10 w-full rounded-md flex items-center justify-center text-sm",
                          !day || !isCurrentMonth ? "invisible" : "",
                          isSelected ? "bg-blue-600 text-white" : "",
                          !isSelected && isAvailable && !isPast && isCurrentMonth ? "hover:bg-blue-50" : "",
                          (!isAvailable || isPast) && isCurrentMonth ? "text-gray-300 cursor-not-allowed" : ""
                        )}
                        onClick={() => day && isAvailable && !isPast && handleDateSelect(day)}
                      >
                        {day ? format(day, 'd') : ''}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div>
          <div className="bg-white rounded-lg border shadow-sm overflow-hidden h-full">
            <div className="bg-blue-50 p-4 border-b">
              <h3 className="text-base font-medium text-blue-700 flex items-center">
                <Clock className="mr-2 h-5 w-5" />
                Selecione um horário
              </h3>
            </div>
            <div className="p-4">
              {isLoading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  <p className="text-gray-500">Carregando horários disponíveis...</p>
                </div>
              ) : timeSlots.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="text-gray-400 mb-3">
                    <Clock className="h-12 w-12 mx-auto opacity-30" />
                  </div>
                  <p className="text-gray-500 mb-1">Nenhum horário disponível para esta data.</p>
                  <p className="text-sm text-gray-400">Tente selecionar outra data.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto p-2">
                  {timeSlots.map((slot, index) => (
                    <div
                      key={index}
                      className={cn(
                        "p-3 rounded-md border text-center cursor-pointer transition-all",
                        slot.isAvailable
                          ? selectedTimeSlot?.startTime === slot.startTime
                            ? "bg-blue-100 border-blue-400 text-blue-800 shadow-sm ring-2 ring-blue-300 ring-opacity-50"
                            : "hover:bg-blue-50 hover:border-blue-200"
                          : "bg-gray-100 text-gray-400 cursor-not-allowed"
                      )}
                      onClick={() => slot.isAvailable && handleTimeSlotSelect(slot)}
                    >
                      <div className="flex items-center justify-center">
                        <Clock className={cn(
                          "h-4 w-4 mr-2",
                          selectedTimeSlot?.startTime === slot.startTime ? "text-blue-600" : "text-gray-500"
                        )} />
                        <span className="font-medium">
                          {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Alerta de conflitos de horário */}
      {formData.dateTimeConflicts && formData.dateTimeConflicts.length > 0 && (
        <div className="mt-6 p-4 bg-red-50 rounded-lg border border-red-200 animate-pulse">
          <h4 className="text-base font-semibold text-red-700 mb-2 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Atenção: Conflitos de horário detectados
          </h4>
          <p className="text-sm text-red-600 mb-3">Os seguintes horários não estão disponíveis devido a outros agendamentos:</p>
          <div className="bg-white p-3 rounded-md border border-red-100 mb-3">
            <ul className="list-disc pl-5 text-sm text-red-700 space-y-1">
              {formData.dateTimeConflicts.map((conflito, index) => (
                <li key={index} className="py-1">
                  <span className="font-medium">{conflito.dataFormatada}</span> das <span className="font-medium">{conflito.horaInicio}</span> às <span className="font-medium">{conflito.horaFim}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-sm text-red-600 font-medium">Por favor, selecione uma data ou horário diferente para continuar.</p>
        </div>
      )}
      
      {/* Informação do horário selecionado */}
      {selectedDate && selectedTimeSlot && (
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
          <h4 className="text-sm font-medium text-blue-800 mb-2">Agendamento selecionado:</h4>
          <div className="flex items-center text-blue-700">
            <CalendarIcon className="h-4 w-4 mr-2" />
            <span className="mr-4">{format(selectedDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
            <Clock className="h-4 w-4 mr-2" />
            <span>{formatTime(selectedTimeSlot.startTime)} - {formatTime(selectedTimeSlot.endTime)}</span>
          </div>
        </div>
      )}
    </div>
  );
};
