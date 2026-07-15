'use client';

import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useServices } from '@/contexts/Services';

interface ServiceFilterProps {
  value: string;
  onChange: (value: string) => void;
}

export function ServiceFilter({ value, onChange }: ServiceFilterProps) {
  const { services, isLoading } = useServices();
  
  return (
    <div className="space-y-2">
      <Label htmlFor="service">Serviço</Label>
      <Select 
        value={value} 
        onValueChange={onChange}
        disabled={isLoading}
      >
        <SelectTrigger id="service">
          <SelectValue placeholder="Todos os serviços" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">Todos os serviços</SelectItem>
          {services.map(service => (
            <SelectItem key={service.id} value={service.id}>
              {service.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
