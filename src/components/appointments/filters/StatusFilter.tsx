'use client';

import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { AppointmentStatus } from '@/contexts/Appointments/interfaces';
import { getStatusLabel } from '@/utils/statusUtils';

interface StatusFilterProps {
  value: AppointmentStatus | '';
  onChange: (value: string) => void;
}

export function StatusFilter({ value, onChange }: StatusFilterProps) {
  const statuses: AppointmentStatus[] = [
    'scheduled',
    'completed',
    'cancelled',
    'no_show',
    'rescheduled'
  ];
  
  return (
    <div className="space-y-2">
      <Label htmlFor="status">Status</Label>
      <Select 
        value={value} 
        onValueChange={onChange}
      >
        <SelectTrigger id="status">
          <SelectValue placeholder="Todos os status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">Todos os status</SelectItem>
          {statuses.map(status => (
            <SelectItem key={status} value={status}>
              {getStatusLabel(status)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
