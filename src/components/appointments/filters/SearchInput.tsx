'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function SearchInput({ value, onChange }: SearchInputProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="search">Busca</Label>
      <div className="relative">
        <Search 
          className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" 
          aria-hidden="true"
        />
        <Input
          id="search"
          placeholder="Nome do cliente, notas..."
          className="pl-8"
          value={value}
          onChange={onChange}
          aria-label="Buscar agendamentos"
        />
      </div>
    </div>
  );
}
