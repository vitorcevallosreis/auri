'use client';

import React from 'react';
import { CalendarContainerProps } from '@/types/calendar';
import { DayView } from './DayView';
import { WeekView } from './WeekView';
import { MonthView } from './MonthView';
import { AgendaView } from './AgendaView';
import { formatDateForTitle } from '@/utils/dateUtils';
import { AppointmentSkeleton } from '../cards/AppointmentSkeleton';
import { motion, AnimatePresence } from 'framer-motion';

export function CalendarContainer({
  view,
  currentDate,
  isLoading = false,
  appointments = [],
  onAppointmentClick = () => {},
  renderTitle = false
}: CalendarContainerProps) {
  // If we're just rendering the title
  if (renderTitle) {
    return <span>{formatDateForTitle(currentDate, view)}</span>;
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="p-4">
        <AppointmentSkeleton 
          variant={view === 'month' ? 'minimal' : view === 'week' ? 'compact' : 'default'} 
          count={view === 'month' ? 10 : 5} 
        />
      </div>
    );
  }

  // Render the appropriate view with animation
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={view}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
      >
        {view === 'day' && (
          <DayView 
            currentDate={currentDate} 
            appointments={appointments} 
            onAppointmentClick={onAppointmentClick} 
          />
        )}
        {view === 'week' && (
          <WeekView 
            currentDate={currentDate} 
            appointments={appointments} 
            onAppointmentClick={onAppointmentClick} 
          />
        )}
        {view === 'month' && (
          <MonthView 
            currentDate={currentDate} 
            appointments={appointments} 
            onAppointmentClick={onAppointmentClick} 
          />
        )}
        {view === 'agenda' && (
          <AgendaView 
            currentDate={currentDate} 
            appointments={appointments} 
            onAppointmentClick={onAppointmentClick} 
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
}
