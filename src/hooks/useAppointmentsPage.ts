import { useState, useEffect, useCallback, useContext } from 'react';
import { useAppointments } from '@/contexts/Appointments';
import { useProfessionals } from '@/contexts/Professionals';
import { useServices } from '@/contexts/Services';
import { AuthContext } from '@/contexts/Auth';
import { Appointment } from '@/contexts/Appointments/interfaces';
import { format, addDays, addMonths, subMonths } from 'date-fns';
import { CalendarView } from '@/types/calendar';

export function useAppointmentsPage() {
  // Contexts
  const { 
    appointments, 
    isLoading, 
    error, 
    filters,
    setFilters,
    fetchAppointments,
  } = useAppointments();
  
  const { user } = useContext(AuthContext);
  const { professionals, fetchProfessionals } = useProfessionals();
  const { services, getServices } = useServices();
  
  // Appointment state
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [showAppointmentDetails, setShowAppointmentDetails] = useState(false);
  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const [appointmentToEdit, setAppointmentToEdit] = useState<Appointment | null>(null);
  
  // Calendar state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState<CalendarView>('week');
  
  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        if (professionals.length === 0 && user?.company_id) {
          await fetchProfessionals(user.company_id as any);
        }
        if (services.length === 0) {
          await getServices();
        }
      } catch (error) {
        console.error('Error loading initial data:', error);
      }
    };
    
    loadData();
  }, [professionals.length, services.length, fetchProfessionals, getServices, user?.company_id]);
  
  // Appointment handlers
  const handleAppointmentClick = useCallback((appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setShowAppointmentDetails(true);
  }, []);

  const handleNewAppointment = useCallback(() => {
    setAppointmentToEdit(null);
    setShowAppointmentForm(true);
  }, []);

  const handleEditAppointment = useCallback((appointment: Appointment) => {
    setAppointmentToEdit(appointment);
    setShowAppointmentForm(true);
    setShowAppointmentDetails(false);
  }, []);

  const handleFormClose = useCallback(() => {
    setShowAppointmentForm(false);
    fetchAppointments();
  }, [fetchAppointments]);

  const handleDetailsClose = useCallback(() => {
    setShowAppointmentDetails(false);
  }, []);

  const handleRefresh = useCallback(() => {
    fetchAppointments();
  }, [fetchAppointments]);
  
  // Calendar navigation
  const goToPrevious = useCallback(() => {
    setCurrentDate(prev => {
      if (calendarView === 'day') return addDays(prev, -1);
      if (calendarView === 'week') return addDays(prev, -7);
      if (calendarView === 'month') return subMonths(prev, 1);
      return prev;
    });
  }, [calendarView]);

  const goToNext = useCallback(() => {
    setCurrentDate(prev => {
      if (calendarView === 'day') return addDays(prev, 1);
      if (calendarView === 'week') return addDays(prev, 7);
      if (calendarView === 'month') return addMonths(prev, 1);
      return prev;
    });
  }, [calendarView]);

  const goToToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);
  
  // Filter handlers
  const handleFilterChange = useCallback((type: string, value: string | Date | null) => {
    if (value === '') value = null;
    setFilters(prev => ({ ...prev, [type]: value }));
  }, [setFilters]);
  
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    handleFilterChange('searchQuery', value);
  }, [handleFilterChange]);
  
  const clearFilters = useCallback(() => {
    setFilters({});
    setSearchQuery('');
  }, [setFilters]);
  
  const toggleFilters = useCallback(() => {
    setShowFilters(prev => !prev);
  }, []);
  
  return {
    // Data
    appointments,
    professionals,
    services,
    isLoading,
    error,
    
    // Calendar state
    currentDate,
    calendarView,
    setCalendarView,
    
    // Navigation
    goToPrevious,
    goToNext,
    goToToday,
    
    // Appointment handlers
    handleAppointmentClick,
    handleNewAppointment,
    handleEditAppointment,
    handleFormClose,
    handleDetailsClose,
    handleRefresh,
    
    // Filter state and handlers
    filters,
    showFilters,
    searchQuery,
    handleFilterChange,
    handleSearchChange,
    clearFilters,
    toggleFilters,
    
    // Selected appointment state
    selectedAppointment,
    showAppointmentDetails,
    showAppointmentForm,
    appointmentToEdit,
  };
}
