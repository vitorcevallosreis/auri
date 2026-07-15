'use client';

import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useProfessionals } from '@/contexts/Professionals';

interface ProfessionalFilterProps {
  value: string;
  onChange: (value: string) => void;
}

export function ProfessionalFilter({ value, onChange }: ProfessionalFilterProps) {
  const { professionals, loading } = useProfessionals();
  
  return (
    <div className="space-y-2">
      <Label htmlFor="professional">Profissional</Label>
      <Select 
        value={value} 
        onValueChange={onChange}
        disabled={loading}
      >
        <SelectTrigger id="professional">
          <SelectValue placeholder="Todos os profissionais" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">Todos os profissionais</SelectItem>
          {professionals.map(professional => (
            <SelectItem key={professional.id} value={professional.id}>
              {professional.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
