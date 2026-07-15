'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, X } from 'lucide-react';
import { SearchInput } from './SearchInput';
import { ProfessionalFilter } from './ProfessionalFilter';
import { ServiceFilter } from './ServiceFilter';
import { StatusFilter } from './StatusFilter';
import { useAppointmentFilters } from '@/hooks/useAppointmentFilters';
import { motion, AnimatePresence } from 'framer-motion';

interface FiltersPanelProps {
  isVisible: boolean;
  onRefresh: () => void;
  id?: string;
}

export function FiltersPanel({ isVisible, onRefresh, id }: FiltersPanelProps) {
  const {
    searchQuery,
    handleSearchChange,
    handleProfessionalChange,
    handleServiceChange,
    handleStatusChange,
    clearFilters,
    selectedProfessionalId,
    selectedServiceId,
    selectedStatus
  } = useAppointmentFilters();

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          id={id}
        >
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Filtros</CardTitle>
              <CardDescription>Filtre os agendamentos por profissional, serviço, status ou data</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <SearchInput 
                  value={searchQuery} 
                  onChange={handleSearchChange} 
                />
                
                <ProfessionalFilter 
                  value={selectedProfessionalId} 
                  onChange={handleProfessionalChange} 
                />
                
                <ServiceFilter 
                  value={selectedServiceId} 
                  onChange={handleServiceChange} 
                />
                
                <StatusFilter 
                  value={selectedStatus} 
                  onChange={handleStatusChange} 
                />
              </div>
              
              <div className="flex justify-between mt-4">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={clearFilters}
                  aria-label="Limpar todos os filtros"
                >
                  <X className="mr-2 h-4 w-4" aria-hidden="true" /> Limpar Filtros
                </Button>
                <Button 
                  size="sm" 
                  onClick={onRefresh}
                  aria-label="Atualizar agendamentos"
                >
                  <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" /> Atualizar
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
