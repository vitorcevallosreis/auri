"use client";

import React, { useState, useEffect } from 'react';
import { useProfessionals } from '@/contexts/Professionals';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, Calendar, ArrowLeft, Save, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { UUID } from 'crypto';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { ProfessionalAvailability } from '@/contexts/Professionals/interfaces';

const DAYS_OF_WEEK = [
  { value: 'monday', label: 'Segunda-feira' },
  { value: 'tuesday', label: 'Terça-feira' },
  { value: 'wednesday', label: 'Quarta-feira' },
  { value: 'thursday', label: 'Quinta-feira' },
  { value: 'friday', label: 'Sexta-feira' },
  { value: 'saturday', label: 'Sábado' },
  { value: 'sunday', label: 'Domingo' },
];

export default function ProfessionalAvailabilityPage() {
  const { professionals, loading, updateProfessionalAvailability } = useProfessionals();
  
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<UUID | null>(null);
  const [availabilityData, setAvailabilityData] = useState<ProfessionalAvailability[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Selecionar o profissional e carregar sua disponibilidade
  useEffect(() => {
    if (selectedProfessionalId) {
      const professional = professionals.find(p => p.id === selectedProfessionalId);
      if (professional && professional.availability) {
        setAvailabilityData(professional.availability);
      } else {
        // Criar disponibilidade padrão se não existir
        const defaultAvailability = DAYS_OF_WEEK.map(day => ({
          day_of_week: day.value,
          is_available: day.value !== 'sunday',
          start_time: '09:00',
          end_time: '17:00',
          break_start: '12:00',
          break_end: '13:00',
          max_simultaneous_clients: 1
        }));
        setAvailabilityData(defaultAvailability);
      }
    }
  }, [selectedProfessionalId, professionals]);
  
  // Adicionar disponibilidade específica para uma data
  const addSpecificDateAvailability = () => {
    const today = new Date();
    const formattedDate = format(today, 'yyyy-MM-dd');
    
    const newDateAvailability = {
      specific_date: formattedDate,
      is_available: true,
      start_time: '09:00',
      end_time: '17:00',
      break_start: '12:00',
      break_end: '13:00',
      max_simultaneous_clients: 1
    };
    
    setAvailabilityData(prev => [...prev, newDateAvailability]);
  };
  
  // Remover disponibilidade
  const removeAvailability = (index: number) => {
    setAvailabilityData(prev => prev.filter((_, i) => i !== index));
  };
  
  // Atualizar um campo específico da disponibilidade
  const updateAvailabilityField = (index: number, field: string, value: any) => {
    setAvailabilityData(prev => 
      prev.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    );
  };
  
  // Salvar alterações
  const saveAvailability = async () => {
    if (!selectedProfessionalId) return;
    
    setIsSaving(true);
    
    try {
      await updateProfessionalAvailability(selectedProfessionalId, availabilityData);
      toast.success('Disponibilidade atualizada com sucesso!');
      setIsEditing(false);
    } catch (error) {
      console.error('Erro ao atualizar disponibilidade:', error);
      toast.error('Erro ao atualizar disponibilidade');
    } finally {
      setIsSaving(false);
    }
  };
  
  // Filtrar disponibilidades regulares (dias da semana) e específicas (datas)
  const regularAvailability = availabilityData.filter(a => !a.specific_date);
  const specificAvailability = availabilityData.filter(a => a.specific_date);
  
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="icon" asChild>
            <Link href="/professionals">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">Gerenciar Disponibilidade</h1>
        </div>
        
        {selectedProfessionalId && (
          <div className="flex space-x-2">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={() => setIsEditing(false)} disabled={isSaving}>
                  Cancelar
                </Button>
                <Button onClick={saveAvailability} disabled={isSaving}>
                  {isSaving ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Salvando...
                    </span>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Salvar
                    </>
                  )}
                </Button>
              </>
            ) : (
              <Button onClick={() => setIsEditing(true)}>
                Editar Disponibilidade
              </Button>
            )}
          </div>
        )}
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Selecione um Profissional</CardTitle>
          <CardDescription>
            Escolha um profissional para gerenciar sua disponibilidade
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={selectedProfessionalId?.toString() || ''}
            onValueChange={(value) => setSelectedProfessionalId(value as unknown as UUID)}
            disabled={loading}
          >
            <SelectTrigger className="w-full md:w-[300px]">
              <SelectValue placeholder="Selecione um profissional" />
            </SelectTrigger>
            <SelectContent>
              {professionals.map((professional) => (
                <SelectItem key={professional.id.toString()} value={professional.id.toString()}>
                  {professional.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
      
      {selectedProfessionalId ? (
        <Tabs defaultValue="weekly" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="weekly">
              <Calendar className="h-4 w-4 mr-2" />
              Disponibilidade Semanal
            </TabsTrigger>
            <TabsTrigger value="specific">
              <Clock className="h-4 w-4 mr-2" />
              Datas Específicas
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="weekly" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle>Disponibilidade Semanal</CardTitle>
                <CardDescription>
                  Configure os horários regulares de atendimento para cada dia da semana
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 7 }).map((_, i) => (
                      <Skeleton key={i} className="h-20 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {DAYS_OF_WEEK.map((day, index) => {
                      const availabilityIndex = regularAvailability.findIndex(a => a.day_of_week === day.value);
                      const dayAvailability = availabilityIndex >= 0 ? regularAvailability[availabilityIndex] : null;
                      
                      return (
                        <div key={day.value} className="p-4 border rounded-lg">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center space-x-4">
                              <div className="flex items-center space-x-2">
                                <Switch
                                  id={`available-${day.value}`}
                                  checked={dayAvailability?.is_available || false}
                                  onCheckedChange={(checked) => {
                                    if (availabilityIndex >= 0) {
                                      updateAvailabilityField(availabilityIndex, 'is_available', checked);
                                    }
                                  }}
                                  disabled={!isEditing}
                                />
                                <Label htmlFor={`available-${day.value}`} className="font-medium">
                                  {day.label}
                                </Label>
                              </div>
                            </div>
                            
                            {dayAvailability?.is_available && (
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full md:w-auto">
                                <div className="space-y-1">
                                  <Label htmlFor={`start-time-${day.value}`} className="text-xs">
                                    Horário Inicial
                                  </Label>
                                  <Input
                                    id={`start-time-${day.value}`}
                                    type="time"
                                    value={dayAvailability.start_time}
                                    onChange={(e) => updateAvailabilityField(availabilityIndex, 'start_time', e.target.value)}
                                    disabled={!isEditing}
                                  />
                                </div>
                                
                                <div className="space-y-1">
                                  <Label htmlFor={`end-time-${day.value}`} className="text-xs">
                                    Horário Final
                                  </Label>
                                  <Input
                                    id={`end-time-${day.value}`}
                                    type="time"
                                    value={dayAvailability.end_time}
                                    onChange={(e) => updateAvailabilityField(availabilityIndex, 'end_time', e.target.value)}
                                    disabled={!isEditing}
                                  />
                                </div>
                                
                                <div className="space-y-1">
                                  <Label htmlFor={`max-clients-${day.value}`} className="text-xs">
                                    Clientes Simultâneos
                                  </Label>
                                  <Input
                                    id={`max-clients-${day.value}`}
                                    type="number"
                                    min="1"
                                    value={dayAvailability.max_simultaneous_clients}
                                    onChange={(e) => updateAvailabilityField(availabilityIndex, 'max_simultaneous_clients', parseInt(e.target.value))}
                                    disabled={!isEditing}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                          
                          {dayAvailability?.is_available && (
                            <div className="mt-4 pt-4 border-t">
                              <h4 className="text-sm font-medium mb-2">Intervalo</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <Label htmlFor={`break-start-${day.value}`} className="text-xs">
                                    Início do Intervalo
                                  </Label>
                                  <Input
                                    id={`break-start-${day.value}`}
                                    type="time"
                                    value={dayAvailability.break_start}
                                    onChange={(e) => updateAvailabilityField(availabilityIndex, 'break_start', e.target.value)}
                                    disabled={!isEditing}
                                  />
                                </div>
                                
                                <div className="space-y-1">
                                  <Label htmlFor={`break-end-${day.value}`} className="text-xs">
                                    Fim do Intervalo
                                  </Label>
                                  <Input
                                    id={`break-end-${day.value}`}
                                    type="time"
                                    value={dayAvailability.break_end}
                                    onChange={(e) => updateAvailabilityField(availabilityIndex, 'break_end', e.target.value)}
                                    disabled={!isEditing}
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="specific" className="mt-0">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Datas Específicas</CardTitle>
                  <CardDescription>
                    Configure disponibilidade para datas específicas (feriados, eventos, etc.)
                  </CardDescription>
                </div>
                {isEditing && (
                  <Button onClick={addSpecificDateAvailability} variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Data
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : specificAvailability.length > 0 ? (
                  <div className="space-y-6">
                    {specificAvailability.map((dateAvailability, index) => {
                      const availabilityIndex = availabilityData.findIndex(a => 
                        a.specific_date && a.specific_date === dateAvailability.specific_date
                      );
                      
                      return (
                        <div key={`date-${index}`} className="p-4 border rounded-lg">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center space-x-4">
                              <div className="flex items-center space-x-2">
                                <Switch
                                  id={`available-date-${index}`}
                                  checked={dateAvailability.is_available}
                                  onCheckedChange={(checked) => {
                                    updateAvailabilityField(availabilityIndex, 'is_available', checked);
                                  }}
                                  disabled={!isEditing}
                                />
                                <div>
                                  <Label htmlFor={`available-date-${index}`} className="font-medium">
                                    {dateAvailability.specific_date && format(new Date(dateAvailability.specific_date), 'dd/MM/yyyy (EEEE)', { locale: ptBR })}
                                  </Label>
                                  {isEditing && (
                                    <Input
                                      type="date"
                                      value={dateAvailability.specific_date}
                                      onChange={(e) => updateAvailabilityField(availabilityIndex, 'specific_date', e.target.value)}
                                      className="mt-1"
                                    />
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            {isEditing && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeAvailability(availabilityIndex)}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:text-red-300 dark:hover:bg-red-500/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                          
                          {dateAvailability.is_available && (
                            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="space-y-1">
                                <Label htmlFor={`date-start-time-${index}`} className="text-xs">
                                  Horário Inicial
                                </Label>
                                <Input
                                  id={`date-start-time-${index}`}
                                  type="time"
                                  value={dateAvailability.start_time}
                                  onChange={(e) => updateAvailabilityField(availabilityIndex, 'start_time', e.target.value)}
                                  disabled={!isEditing}
                                />
                              </div>
                              
                              <div className="space-y-1">
                                <Label htmlFor={`date-end-time-${index}`} className="text-xs">
                                  Horário Final
                                </Label>
                                <Input
                                  id={`date-end-time-${index}`}
                                  type="time"
                                  value={dateAvailability.end_time}
                                  onChange={(e) => updateAvailabilityField(availabilityIndex, 'end_time', e.target.value)}
                                  disabled={!isEditing}
                                />
                              </div>
                              
                              <div className="space-y-1">
                                <Label htmlFor={`date-max-clients-${index}`} className="text-xs">
                                  Clientes Simultâneos
                                </Label>
                                <Input
                                  id={`date-max-clients-${index}`}
                                  type="number"
                                  min="1"
                                  value={dateAvailability.max_simultaneous_clients}
                                  onChange={(e) => updateAvailabilityField(availabilityIndex, 'max_simultaneous_clients', parseInt(e.target.value))}
                                  disabled={!isEditing}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Clock className="h-12 w-12 mx-auto text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-medium">Nenhuma data específica configurada</h3>
                    <p className="text-muted-foreground">
                      Adicione datas específicas para configurar disponibilidade especial para feriados ou eventos.
                    </p>
                    {isEditing && (
                      <Button className="mt-4" onClick={addSpecificDateAvailability}>
                        <Plus className="mr-2 h-4 w-4" />
                        Adicionar Data Específica
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <Clock className="h-12 w-12 mx-auto text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">Selecione um profissional</h3>
            <p className="text-muted-foreground">
              Escolha um profissional para visualizar e gerenciar sua disponibilidade.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
