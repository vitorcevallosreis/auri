'use client';

import React, { useState, useEffect } from 'react';
import { AppointmentsProvider, useAppointments } from '@/contexts/Appointments';
import { Appointment } from '@/contexts/Appointments/interfaces';
import { WeeklyCalendar } from '@/components/appointments/WeeklyCalendar';
import { AppointmentDetails } from '@/components/appointments/AppointmentDetails';
import { AppointmentForm } from '@/components/appointments/AppointmentForm';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AppointmentStatus } from '@/contexts/Appointments/interfaces';

import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw } from 'lucide-react';

// Mapeamento de cores para cada status
const statusColorMap: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300",     // agendado
  completed: "bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300",   // concluído
  cancelled: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300",       // cancelado
  no_show: "bg-muted text-foreground",       // não compareceu
  rescheduled: "bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-300" // reagendado
};

// Função para obter rótulo legível do status em português
const getStatusLabel = (status: AppointmentStatus): string => {
  const statusLabels: Record<AppointmentStatus, string> = {
    scheduled: "Agendado",
    completed: "Concluído",
    cancelled: "Cancelado",
    no_show: "Não Compareceu",
    rescheduled: "Reagendado"
  };
  return statusLabels[status] || status.toString();
};

const AppointmentsPageContent = () => {
  // Usando o cliente Supabase já configurado com o schema 'nexa'
  const { 
    appointments, 
    isLoading, 
    error, 
    fetchAppointments,
  } = useAppointments();
  
  // Estados para gerenciar os agendamentos
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [showAppointmentDetails, setShowAppointmentDetails] = useState(false);
  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const [appointmentToEdit, setAppointmentToEdit] = useState<Appointment | null>(null);
  
  // Handlers para interações
  const handleAppointmentClick = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setShowAppointmentDetails(true);
  };

  const handleNewAppointment = () => {
    setAppointmentToEdit(null);
    setShowAppointmentForm(true);
  };

  const handleEditAppointment = (appointment: Appointment) => {
    setAppointmentToEdit(appointment);
    setShowAppointmentForm(true);
    setShowAppointmentDetails(false);
  };

  const handleFormClose = () => {
    setShowAppointmentForm(false);
    fetchAppointments();
  };

  const handleDetailsClose = () => {
    setShowAppointmentDetails(false);
  };

  const handleRefresh = () => {
    fetchAppointments();
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Cabeçalho */}
      <div className="flex justify-between items-center mb-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold">Agendamentos</h2>
          <p className="text-muted-foreground">
            Gerencie todos os seus agendamentos de forma eficiente.
          </p>
        </div>
        <Button onClick={handleNewAppointment}>
          <Plus className="mr-2 h-4 w-4" /> Novo Agendamento
        </Button>
      </div>
      
      {/* Calendário */}
      <Card>
        <CardContent className="p-4">
          {isLoading ? (
            <div className="h-[500px] flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <WeeklyCalendar onAppointmentClick={handleAppointmentClick} />
          )}
        </CardContent>
      </Card>
      
      {/* Mensagem de Erro */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300">
          <p>Ocorreu um erro ao carregar os agendamentos: {error}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Tentar Novamente
          </Button>
        </div>
      )}

      {/* Detalhes do Agendamento */}
      <AppointmentDetails
        appointment={selectedAppointment}
        isOpen={showAppointmentDetails}
        onClose={handleDetailsClose}
        onEdit={handleEditAppointment}
      />

      {/* Formulário de Agendamento */}
      <AppointmentForm
        isOpen={showAppointmentForm}
        onClose={handleFormClose}
        appointmentToEdit={appointmentToEdit}
      />
    </div>
  );
};

export default function AppointmentsPage() {
  return (
    <AppointmentsProvider>
      <AppointmentsPageContent />
    </AppointmentsProvider>
  );
}
