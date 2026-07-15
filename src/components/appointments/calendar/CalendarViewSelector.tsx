'use client';

import React from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarViewSelectorProps } from '@/types/calendar';

export function CalendarViewSelector({ currentView, onViewChange }: CalendarViewSelectorProps) {
  return (
    <Tabs 
      value={currentView} 
      onValueChange={(value) => onViewChange(value as any)} 
      className="w-full sm:w-auto"
    >
      <TabsList className="grid grid-cols-4 w-full sm:w-auto">
        <TabsTrigger 
          value="day"
          aria-label="Visualização diária"
        >
          Dia
        </TabsTrigger>
        <TabsTrigger 
          value="week"
          aria-label="Visualização semanal"
        >
          Semana
        </TabsTrigger>
        <TabsTrigger 
          value="month"
          aria-label="Visualização mensal"
        >
          Mês
        </TabsTrigger>
        <TabsTrigger 
          value="agenda"
          aria-label="Visualização de agenda"
        >
          Agenda
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
