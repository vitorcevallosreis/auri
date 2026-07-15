import React, { useState } from 'react';
import { useProfessionals } from '@/contexts/Professionals';
import { ProfessionalAvailability } from '@/contexts/Professionals/interfaces';
import { Service } from '@/contexts/Services/interfaces';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { UUID } from 'crypto';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';

interface ProfessionalAvailabilityFormProps {
  professionalId: UUID;
  availability: ProfessionalAvailability[];
  services: Service[];
}

// Custom TimeInput component
const TimeInput = ({ value, onChange }: { value: string, onChange: (value: string) => void }) => {
  return (
    <input
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
    />
  );
};

const weekdays = [
  { id: 1, name: 'Segunda-feira' },
  { id: 2, name: 'Terça-feira' },
  { id: 3, name: 'Quarta-feira' },
  { id: 4, name: 'Quinta-feira' },
  { id: 5, name: 'Sexta-feira' },
  { id: 6, name: 'Sábado' },
  { id: 0, name: 'Domingo' },
];

export function ProfessionalAvailabilityForm({ 
  professionalId, 
  availability, 
  services 
}: ProfessionalAvailabilityFormProps) {
  const { setAvailability, loading } = useProfessionals();
  
  // Create a map of service availability by weekday and service
  const availabilityMap = new Map<string, ProfessionalAvailability>();
  
  availability.forEach(item => {
    const key = `${item.service_id}-${item.weekday}`;
    availabilityMap.set(key, item);
  });
  
  const [formState, setFormState] = useState<Map<string, {
    checked: boolean;
    startTime: string;
    endTime: string;
    maxSimultaneousClients: number;
  }>>(new Map(
    services.flatMap(service => 
      weekdays.map(day => {
        const key = `${service.id}-${day.id}`;
        const existing = availabilityMap.get(key);
        return [
          key, 
          { 
            checked: !!existing, 
            startTime: existing?.start_time || '09:00',
            endTime: existing?.end_time || '18:00',
            maxSimultaneousClients: existing?.max_simultaneous_clients || 1
          }
        ];
      })
    )
  ));
  
  const handleCheckboxChange = (key: string, checked: boolean) => {
    setFormState(new Map(formState).set(key, {
      ...formState.get(key)!,
      checked
    }));
  };
  
  const handleTimeChange = (key: string, field: 'startTime' | 'endTime', value: string) => {
    setFormState(new Map(formState).set(key, {
      ...formState.get(key)!,
      [field]: value
    }));
  };
  
  const handleMaxClientsChange = (key: string, value: string) => {
    const numValue = parseInt(value);
    if (isNaN(numValue) || numValue < 1) return;
    
    setFormState(new Map(formState).set(key, {
      ...formState.get(key)!,
      maxSimultaneousClients: numValue
    }));
  };
  
  const handleSubmit = async () => {
    const newAvailability: Omit<ProfessionalAvailability, 'id' | 'created_at' | 'updated_at'>[] = [];
    
    formState.forEach((value, key) => {
      if (value.checked) {
        const [serviceId, weekday] = key.split('-');
        newAvailability.push({
          professional_id: professionalId,
          service_id: serviceId as unknown as UUID,
          weekday: parseInt(weekday),
          start_time: value.startTime,
          end_time: value.endTime,
          max_simultaneous_clients: value.maxSimultaneousClients
        });
      }
    });
    
    try {
      await setAvailability(newAvailability);
      toast.success('Disponibilidade atualizada com sucesso!');
    } catch (error) {
      toast.error('Erro ao atualizar disponibilidade');
    }
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Configurar Disponibilidade</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {services.map(service => (
            <div key={service.id.toString()} className="space-y-4">
              <h3 className="text-lg font-medium">{service.name}</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {weekdays.map(day => {
                  const key = `${service.id}-${day.id}`;
                  const state = formState.get(key)!;
                  
                  return (
                    <div key={key} className="flex flex-col space-y-2 p-4 border rounded-md">
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id={key} 
                          checked={state.checked}
                          onCheckedChange={(checked) => handleCheckboxChange(key, !!checked)}
                        />
                        <label htmlFor={key} className="font-medium cursor-pointer">
                          {day.name}
                        </label>
                      </div>
                      
                      {state.checked && (
                        <div className="grid grid-cols-1 gap-2 mt-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <label className="text-sm">Início</label>
                              <TimeInput
                                value={state.startTime}
                                onChange={(value) => handleTimeChange(key, 'startTime', value)}
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-sm">Fim</label>
                              <TimeInput
                                value={state.endTime}
                                onChange={(value) => handleTimeChange(key, 'endTime', value)}
                              />
                            </div>
                          </div>
                          
                          <div className="space-y-1 mt-2">
                            <label className="text-sm">Máximo de clientes simultâneos</label>
                            <Input
                              type="number"
                              min="1"
                              value={state.maxSimultaneousClients}
                              onChange={(e) => handleMaxClientsChange(key, e.target.value)}
                              className="w-full"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Número máximo de clientes que podem ser agendados no mesmo horário
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          
          <Button 
            onClick={handleSubmit} 
            disabled={loading}
            className="w-full md:w-auto"
          >
            {loading ? 'Salvando...' : 'Salvar Disponibilidade'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
