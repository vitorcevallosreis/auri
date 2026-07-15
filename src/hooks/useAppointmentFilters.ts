import { useState, useCallback } from 'react';
import { useAppointments } from '@/contexts/Appointments';
import { AppointmentStatus } from '@/contexts/Appointments/interfaces';

export function useAppointmentFilters() {
  const { filters, setFilters } = useAppointments();
  
  // Local state for filter values
  const [searchQuery, setSearchQuery] = useState(filters.searchQuery || '');
  const [selectedProfessionalId, setSelectedProfessionalId] = useState(filters.professional_id || '');
  const [selectedServiceId, setSelectedServiceId] = useState(filters.service_id || '');
  const [selectedStatus, setSelectedStatus] = useState<AppointmentStatus | ''>(filters.status || '');
  
  // Handler for search input changes
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setFilters({ ...filters, searchQuery: value || undefined });
  }, [filters, setFilters]);
  
  // Handler for professional filter changes
  const handleProfessionalChange = useCallback((value: string) => {
    setSelectedProfessionalId(value);
    setFilters({ ...filters, professional_id: value || undefined });
  }, [filters, setFilters]);
  
  // Handler for service filter changes
  const handleServiceChange = useCallback((value: string) => {
    setSelectedServiceId(value);
    setFilters({ ...filters, service_id: value || undefined });
  }, [filters, setFilters]);
  
  // Handler for status filter changes
  const handleStatusChange = useCallback((value: string) => {
    setSelectedStatus(value as AppointmentStatus | '');
    setFilters({ ...filters, status: (value as AppointmentStatus) || undefined });
  }, [filters, setFilters]);
  
  // Clear all filters
  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedProfessionalId('');
    setSelectedServiceId('');
    setSelectedStatus('');
    setFilters({});
  }, [setFilters]);
  
  return {
    searchQuery,
    selectedProfessionalId,
    selectedServiceId,
    selectedStatus,
    handleSearchChange,
    handleProfessionalChange,
    handleServiceChange,
    handleStatusChange,
    clearFilters
  };
}
