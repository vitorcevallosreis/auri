'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CalendarNavigationProps } from '@/types/calendar';

export function CalendarNavigation({ onPrevious, onNext, onToday }: CalendarNavigationProps) {
  return (
    <div className="flex items-center gap-2">
      <Button 
        variant="outline" 
        size="icon" 
        onClick={onPrevious}
        aria-label="Período anterior"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </Button>
      <Button 
        variant="outline" 
        onClick={onToday}
        aria-label="Ir para hoje"
      >
        Hoje
      </Button>
      <Button 
        variant="outline" 
        size="icon" 
        onClick={onNext}
        aria-label="Próximo período"
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
