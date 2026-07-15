'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AppointmentFilters, Appointment, AppointmentsContextType } from './interfaces';
import { supabase } from '@/lib/supabase/config';
import { format, startOfWeek, endOfWeek, parseISO, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuthStore } from '@/lib/auth-store';

const AppointmentsContext = createContext<AppointmentsContextType | undefined>(undefined);

export const AppointmentsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Usando o cliente Supabase já configurado com o schema 'nexa'
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<AppointmentFilters>({});

  const fetchAppointments = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Obter o company_id do usuário autenticado
      const authState = useAuthStore.getState();
      const company_id = authState.user?.company_id;

      // Buscar os agendamentos
      let query = supabase
        .from('myia_appointments')
        .select('*');
      
      // Aplicar filtro por company_id se disponível
      if (company_id) {
        query = query.eq('company_id', company_id);
      }

      // Apply filters
      if (filters.professional_id) {
        query = query.eq('professional_id', filters.professional_id);
      }
      
      if (filters.service_id) {
        query = query.eq('service_id', filters.service_id);
      }
      
      if (filters.date) {
        query = query.eq('appointment_date', format(filters.date, 'yyyy-MM-dd'));
      }
      
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      
      if (filters.searchQuery) {
        query = query.textSearch('pesquisa', filters.searchQuery);
      }

      const { data: appointmentsData, error: appointmentsError } = await query;

      if (appointmentsError) {
        throw appointmentsError;
      }

      // Extrair IDs únicos de profissionais e serviços
      const professionalIds = [...new Set(appointmentsData.map(a => a.professional_id))];
      const serviceIds = [...new Set(appointmentsData.map(a => a.service_id))];

      // Buscar dados dos profissionais
      const { data: professionalsData, error: professionalsError } = await supabase
        .from('myia_professionals_medical')
        .select('id, nome')
        .in('id', professionalIds);

      if (professionalsError) {
        console.error('Error fetching professionals:', professionalsError);
      }

      // Buscar dados dos serviços
      const { data: servicesData, error: servicesError } = await supabase
        .from('myia_services')
        .select('id, name')
        .in('id', serviceIds);

      if (servicesError) {
        console.error('Error fetching services:', servicesError);
      }

      // Criar mapas para facilitar a busca
      const professionalsMap = new Map();
      if (professionalsData) {
        professionalsData.forEach(prof => {
          professionalsMap.set(prof.id, prof.nome);
        });
      }

      const servicesMap = new Map();
      if (servicesData) {
        servicesData.forEach(service => {
          servicesMap.set(service.id, service.name);
        });
      }

      // Combinar os dados
      const transformedData = appointmentsData.map(appointment => ({
        ...appointment,
        professional_name: professionalsMap.get(appointment.professional_id) || `Profissional ${appointment.professional_id}`,
        service_name: servicesMap.get(appointment.service_id) || `Serviço ${appointment.service_id}`,
      }));

      setAppointments(transformedData);
    } catch (error: any) {
      setError(error.message);
      console.error('Error fetching appointments:', error);
    } finally {
      setIsLoading(false);
    }
  }, [supabase, filters]);

  const createAppointment = async (appointmentData: Omit<Appointment, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      // Obter o company_id do usuário autenticado
      const authState = useAuthStore.getState();
      const company_id = authState.user?.company_id;
      
      // Adicionar o company_id aos dados do agendamento se não estiver definido
      const dataWithCompany = {
        ...appointmentData,
        company_id: appointmentData.company_id || company_id
      };

      const { data, error } = await supabase
        .from('myia_appointments')
        .insert(dataWithCompany)
        .select()
        .single();

      if (error) {
        throw error;
      }

      setAppointments(prev => [...prev, data as Appointment]);
      return data as Appointment;
    } catch (error: any) {
      setError(error.message);
      console.error('Error creating appointment:', error);
      return null;
    }
  };

  // Utilitário para limpar campos undefined do objeto de update
  function cleanUpdateObject<T extends object>(obj: T): Partial<T> {
    return Object.fromEntries(
      Object.entries(obj).filter(([_, v]) => v !== undefined)
    ) as Partial<T>;
  }

  const updateAppointment = async (id: string, data: Partial<Appointment>) => {
    try {
      // Obter o company_id do usuário autenticado
      const authState = useAuthStore.getState();
      const company_id = authState.user?.company_id;
      
      // Limpar os dados para atualização
      const cleanedData = cleanUpdateObject(data);

      if (Object.keys(cleanedData).length === 0) {
        throw new Error("Nenhum campo para atualizar.");
      }

      // Consultar o agendamento atual para verificar o company_id
      const { data: currentAppointment, error: fetchError } = await supabase
        .from('myia_appointments')
        .select('company_id')
        .eq('id', id)
        .single();

      if (fetchError) {
        throw new Error("Não foi possível encontrar o agendamento.");
      }

      // Verificar se o agendamento pertence à empresa do usuário logado
      if (company_id && currentAppointment.company_id !== company_id) {
        throw new Error("Você não tem permissão para editar este agendamento.");
      }

      const { data: updatedData, error } = await supabase
        .from('myia_appointments')
        .update(cleanedData)
        .eq('id', id)
        .eq('company_id', company_id) // Adicionar filtro por company_id
        .select()
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          throw new Error("Nenhum agendamento encontrado para atualizar. Verifique se você tem permissão para editar este registro.");
        }
        throw error;
      }

      setAppointments(prev =>
        prev.map(appointment =>
          appointment.id === id ? { ...appointment, ...updatedData } : appointment
        )
      );
      return updatedData as Appointment;
    } catch (error: any) {
      setError(error.message);
      console.error('Error updating appointment:', error);
      return null;
    }
  };

  const deleteAppointment = async (id: string) => {
    try {
      // Obter o company_id do usuário autenticado
      const authState = useAuthStore.getState();
      const company_id = authState.user?.company_id;
      
      // Verificar se o agendamento pertence à empresa do usuário logado
      const { data: appointment, error: fetchError } = await supabase
        .from('myia_appointments')
        .select('company_id')
        .eq('id', id)
        .single();

      if (fetchError) {
        throw new Error("Não foi possível encontrar o agendamento.");
      }

      if (company_id && appointment.company_id !== company_id) {
        throw new Error("Você não tem permissão para excluir este agendamento.");
      }

      const { error } = await supabase
        .from('myia_appointments')
        .delete()
        .eq('id', id)
        .eq('company_id', company_id); // Adicionar filtro por company_id

      if (error) {
        throw error;
      }

      setAppointments(prev => prev.filter(appointment => appointment.id !== id));
      return true;
    } catch (error: any) {
      setError(error.message);
      console.error('Error deleting appointment:', error);
      return false;
    }
  };

  const getAppointmentsByDay = (date: Date) => {
    const formattedDate = format(date, 'yyyy-MM-dd');
    return appointments.filter(
      appointment => appointment.appointment_date === formattedDate
    );
  };

  const getAppointmentsByWeek = (startDate: Date) => {
    const start = startOfWeek(startDate, { locale: ptBR });
    const end = endOfWeek(startDate, { locale: ptBR });
    
    return appointments.filter(appointment => {
      const appointmentDate = parseISO(appointment.appointment_date);
      return isWithinInterval(appointmentDate, { start, end });
    });
  };

  const clearFilters = () => {
    setFilters({});
  };

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const value: AppointmentsContextType = {
    appointments,
    isLoading,
    error,
    filters,
    setFilters,
    fetchAppointments,
    createAppointment,
    updateAppointment,
    deleteAppointment,
    getAppointmentsByDay,
    getAppointmentsByWeek,
    clearFilters,
  };

  return (
    <AppointmentsContext.Provider value={value}>
      {children}
    </AppointmentsContext.Provider>
  );
};

export const useAppointments = () => {
  const context = useContext(AppointmentsContext);
  if (context === undefined) {
    throw new Error('useAppointments must be used within an AppointmentsProvider');
  }
  return context;
};
