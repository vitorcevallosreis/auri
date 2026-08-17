'use client';

import React, { useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { format, addWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AppointmentFormData } from '..';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Bell, 
  Calendar as CalendarIcon, 
  Repeat, 
  Info, 
  Check, 
  X 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';




interface AdditionalOptionsStepProps {
  formData: AppointmentFormData;
  updateFormData: (data: Partial<AppointmentFormData>) => void;
  isEdit: boolean;
}

export const AdditionalOptionsStep: React.FC<AdditionalOptionsStepProps> = ({
  formData,
  updateFormData,
  isEdit
}) => {
  // Estado para notificação
  const [sendNotification, setSendNotification] = useState<boolean>(
    formData.additionalOptions?.sendNotification ?? true
  );
  
  // Estados para agendamentos recorrentes
  const [isRecurring, setIsRecurring] = useState<boolean>(
    formData.additionalOptions?.isRecurring ?? false
  );
  const [recurrenceType, setRecurrenceType] = useState<string>(
    formData.additionalOptions?.recurrenceType ?? 'sessions'
  );
  const [sessionsCount, setSessionsCount] = useState<number>(
    formData.additionalOptions?.sessionsCount ?? 1
  );
  const [endDate, setEndDate] = useState<Date | undefined>(
    formData.additionalOptions?.endDate
  );
  

  
  // Atualizar formData quando os valores mudarem
  const updateAdditionalOptions = (updates: any) => {
    const updatedOptions = {
      ...formData.additionalOptions,
      ...updates
    };
    
    updateFormData({
      additionalOptions: updatedOptions
    });
  };
  
  // Handlers para notificação
  const handleNotificationChange = (checked: boolean) => {
    setSendNotification(checked);
    updateAdditionalOptions({ sendNotification: checked });
  };
  
  // Handlers para agendamentos recorrentes
  const handleRecurringChange = (checked: boolean) => {
    setIsRecurring(checked);
    updateAdditionalOptions({ isRecurring: checked });
  };
  
  const handleRecurrenceTypeChange = (value: string) => {
    setRecurrenceType(value);
    updateAdditionalOptions({ recurrenceType: value });
  };
  
  const handleSessionsCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value > 0) {
      setSessionsCount(value);
      updateAdditionalOptions({ sessionsCount: value });
    }
  };
  
  const handleEndDateChange = (date: Date | undefined) => {
    setEndDate(date);
    updateAdditionalOptions({ endDate: date });
  };
  


  return (
    <div className="space-y-8">
      {/* Seção de Notificação */}
      <div className="bg-card rounded-lg border p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Bell className="h-5 w-5 text-blue-600 mr-2 dark:text-blue-400" />
            <h3 className="text-lg font-medium text-foreground">Notificação ao Cliente</h3>
          </div>
          <Switch 
            checked={sendNotification} 
            onCheckedChange={handleNotificationChange} 
            className="data-[state=checked]:bg-blue-600"
          />
        </div>
        <p className="text-muted-foreground text-sm">
          {sendNotification 
            ? "O cliente receberá uma notificação sobre este agendamento." 
            : "O cliente não será notificado sobre este agendamento."}
        </p>
      </div>
      
      {/* Seção de Agendamentos Recorrentes */}
      <div className="bg-card rounded-lg border p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Repeat className="h-5 w-5 text-blue-600 mr-2 dark:text-blue-400" />
            <h3 className="text-lg font-medium text-foreground">Agendamento Recorrente</h3>
          </div>
          <Switch 
            checked={isRecurring} 
            onCheckedChange={handleRecurringChange}
            className="data-[state=checked]:bg-blue-600" 
          />
        </div>
        
        {isRecurring && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="recurrence-type" className="text-foreground mb-1 block">
                  Tipo de Recorrência
                </Label>
                <Select 
                  value={recurrenceType} 
                  onValueChange={handleRecurrenceTypeChange}
                >
                  <SelectTrigger id="recurrence-type" className="w-full">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sessions">Por número de sessões</SelectItem>
                    <SelectItem value="date">Por data final</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {recurrenceType === 'sessions' ? (
                <div>
                  <Label htmlFor="sessions-count" className="text-foreground mb-1 block">
                    Número de Sessões
                  </Label>
                  <Input
                    id="sessions-count"
                    type="number"
                    min="1"
                    value={sessionsCount}
                    onChange={handleSessionsCountChange}
                    className="w-full"
                  />
                </div>
              ) : (
                <div>
                  <Label className="text-foreground mb-1 block">
                    Data Final
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !endDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : "Selecione a data final"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={handleEndDateChange}
                        initialFocus
                        locale={ptBR}
                        disabled={(date) => date < (formData.dateTime.date ? addWeeks(formData.dateTime.date, 1) : new Date())}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>
            
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="info">
                <AccordionTrigger className="text-sm text-blue-600 dark:text-blue-400">
                  <div className="flex items-center">
                    <Info className="h-4 w-4 mr-2" />
                    Informações sobre agendamentos recorrentes
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Os agendamentos recorrentes serão criados com base no primeiro agendamento.</li>
                    <li>As sessões serão agendadas no mesmo dia da semana e horário.</li>
                    <li>Caso alguma data não esteja disponível, você será notificado.</li>
                    <li>Você poderá gerenciar cada sessão individualmente após a criação.</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        )}
      </div>
      

    </div>
  );
};
