'use client';

import React from 'react';
import { useAppointmentsPage } from '@/hooks/useAppointmentsPage';
import { CalendarContainer } from './calendar';
import { AppointmentDetails } from '@/components/appointments/AppointmentDetails';
import { AppointmentForm } from '@/components/appointments/AppointmentForm';
import { FiltersPanel } from './filters';
import { ErrorAlert } from '@/components/ui/error-alert';
import { CalendarViewSelector } from './calendar/CalendarViewSelector';
import { CalendarNavigation } from './calendar/CalendarNavigation';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Filter } from 'lucide-react';

export function AppointmentsPage() {
  const {
    // Calendar state
    currentDate,
    calendarView,
    setCalendarView,
    
    // Navigation handlers
    goToPrevious,
    goToNext,
    goToToday,
    
    // Appointment handlers
    appointments,
    isLoading,
    error,
    handleAppointmentClick,
    handleNewAppointment,
    handleEditAppointment,
    handleFormClose,
    handleDetailsClose,
    handleRefresh,
    
    // Filter state
    showFilters,
    toggleFilters,
    
    // Selected appointment state
    selectedAppointment,
    showAppointmentDetails,
    showAppointmentForm,
    appointmentToEdit,
  } = useAppointmentsPage();

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <PageHeader
          title="Central de Agendamentos"
          description="Gerencie todos os seus agendamentos de forma eficiente."
        />
        <div className="flex flex-wrap gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={toggleFilters}
            aria-expanded={showFilters}
            aria-controls="filters-panel"
          >
            <Filter className="mr-2 h-4 w-4" aria-hidden="true" /> 
            {showFilters ? 'Ocultar Filtros' : 'Mostrar Filtros'}
          </Button>
          <Button onClick={handleNewAppointment}>
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" /> Novo Agendamento
          </Button>
        </div>
      </div>
      
      {/* Filters Panel */}
      <FiltersPanel 
        isVisible={showFilters} 
        onRefresh={handleRefresh} 
        id="filters-panel"
      />
      
      {/* Calendar Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <CalendarViewSelector 
          currentView={calendarView}
          onViewChange={setCalendarView}
        />
        <CalendarNavigation
          onPrevious={goToPrevious}
          onNext={goToNext}
          onToday={goToToday}
        />
      </div>
      
      {/* Calendar */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xl">
            <CalendarContainer
              view={calendarView}
              currentDate={currentDate}
              renderTitle={true}
            />
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="min-h-[600px]">
            <CalendarContainer
              view={calendarView}
              currentDate={currentDate}
              isLoading={isLoading}
              appointments={appointments}
              onAppointmentClick={handleAppointmentClick}
            />
          </div>
        </CardContent>
      </Card>
      
      {/* Error Message */}
      {error && (
        <ErrorAlert 
          message={`Ocorreu um erro ao carregar os agendamentos: ${error}`}
          onRetry={handleRefresh}
        />
      )}

      {/* Appointment Details Modal */}
      <AppointmentDetails
        appointment={selectedAppointment}
        isOpen={showAppointmentDetails}
        onClose={handleDetailsClose}
        onEdit={handleEditAppointment}
      />

      {/* Appointment Form Modal */}
      <AppointmentForm
        isOpen={showAppointmentForm}
        onClose={handleFormClose}
        appointmentToEdit={appointmentToEdit}
      />
    </div>
  );
}
