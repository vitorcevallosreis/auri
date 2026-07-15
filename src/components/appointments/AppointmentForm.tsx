'use client';

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/lib/supabase/config';
import { format, parse, parseISO, set } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Appointment, AppointmentStatus, AppointmentType } from '@/contexts/Appointments/interfaces';
import { useAppointments } from '@/contexts/Appointments';
import { toast } from '@/components/ui/use-toast';

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
// import { Calendar } from '@/components/ui/calendar';
// Removendo importação do popover que era usado com o Calendar
// import {
//   Popover,
//   PopoverContent,
//   PopoverTrigger,
// } from '@/components/ui/popover';
import { CalendarIcon, Clock } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

const formSchema = z.object({
  professional_id: z.string().min(1, 'Selecione um profissional'),
  service_id: z.string().min(1, 'Selecione um serviço'),
  client_id: z.string().optional(),
  appointment_date: z.date({
    required_error: 'Selecione uma data',
  }),
  start_time: z.string().min(1, 'Informe um horário de início'),
  end_time: z.string().min(1, 'Informe um horário de término'),
  status: z.string().default('scheduled'),
  notes: z.string().optional(),
  location: z.string().optional(),
  appointment_type: z.string().optional(),
  convenio_usado: z.string().optional(),
  valor_cobrado: z.coerce.number().optional(),
  cliente_nome: z.string().min(1, 'Informe o nome do cliente'),
  cliente_telefone: z.string().optional(),
  cliente_email: z.string().optional(),
});

type FormSchema = z.infer<typeof formSchema>;

interface Professional {
  id: string;
  nome: string;
  especialidade?: string;
}

interface Service {
  id: string;
  name: string;
  tempo_medio?: string;
}

interface Contact {
  id: string;
  name: string;
  number?: string;
  remote_jid?: string;
}

interface AppointmentFormProps {
  isOpen: boolean;
  onClose: () => void;
  appointmentToEdit?: Appointment | null;
}

export const AppointmentForm = ({
  isOpen,
  onClose,
  appointmentToEdit,
}: AppointmentFormProps) => {
  // Usando o cliente Supabase já configurado com o schema 'nexa'
  const { createAppointment, updateAppointment } = useAppointments();
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [useContact, setUseContact] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      status: 'scheduled',
      appointment_type: 'individual',
    },
  });

  const fetchProfessionals = async () => {
    const { data, error } = await supabase
      .from('myia_professionals_medical')
      .select('id, nome, especialidade');

    if (error) {
      console.error('Error fetching professionals:', error);
    } else {
      setProfessionals(data || []);
    }
  };

  const fetchServices = async () => {
    const { data, error } = await supabase
      .from('myia_services')
      .select('id, name, tempo_medio');

    if (error) {
      console.error('Error fetching services:', error);
    } else {
      setServices(data || []);
    }
  };

  const fetchContacts = async () => {
    const { data, error } = await supabase
      .from('myia_contacts')
      .select('id, name, number, remote_jid');

    if (error) {
      console.error('Error fetching contacts:', error);
    } else {
      setContacts(data || []);
    }
  };

  useEffect(() => {
    fetchProfessionals();
    fetchServices();
    fetchContacts();
  }, []);

  useEffect(() => {
    if (appointmentToEdit) {
      // Find selected service to calculate end time if needed
      const service = services.find(s => s.id === appointmentToEdit.service_id);
      setSelectedService(service || null);

      // Check if client_id exists to determine if using a contact
      if (appointmentToEdit.client_id) {
        setUseContact(true);
        const contact = contacts.find(c => c.id === appointmentToEdit.client_id);
        setSelectedContact(contact || null);
      } else {
        setUseContact(false);
      }

      // Format the date correctly
      const appointmentDate = parseISO(appointmentToEdit.appointment_date);

      form.reset({
        professional_id: appointmentToEdit.professional_id,
        service_id: appointmentToEdit.service_id,
        client_id: appointmentToEdit.client_id || undefined,
        appointment_date: appointmentDate,
        start_time: appointmentToEdit.start_time,
        end_time: appointmentToEdit.end_time,
        status: appointmentToEdit.status,
        notes: appointmentToEdit.notes || undefined,
        location: appointmentToEdit.location || undefined,
        appointment_type: appointmentToEdit.appointment_type || 'individual',
        convenio_usado: appointmentToEdit.convenio_usado || undefined,
        valor_cobrado: appointmentToEdit.valor_cobrado || undefined,
        cliente_nome: appointmentToEdit.cliente_nome || '',
        cliente_telefone: appointmentToEdit.cliente_telefone || undefined,
        cliente_email: appointmentToEdit.cliente_email || undefined,
      });
    } else {
      form.reset({
        status: 'scheduled',
        appointment_type: 'individual',
        appointment_date: new Date(),
      });
    }
  }, [appointmentToEdit, form, services, contacts]);

  const calculateEndTime = (startTime: string, durationMinutes: number) => {
    if (!startTime) return '';

    try {
      const [hours, minutes] = startTime.split(':').map(Number);
      const startDate = new Date();
      startDate.setHours(hours, minutes, 0);
      
      const endDate = new Date(startDate.getTime() + durationMinutes * 60000);
      return `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`;
    } catch (error) {
      console.error('Error calculating end time:', error);
      return '';
    }
  };

  const handleServiceChange = (serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    setSelectedService(service || null);
    form.setValue('service_id', serviceId);

    // If we have a start time and the service has an average duration, calculate end time
    const startTime = form.getValues('start_time');
    if (startTime && service?.tempo_medio) {
      const durationMatch = service.tempo_medio.match(/(\d+)/);
      if (durationMatch) {
        const minutes = parseInt(durationMatch[0], 10);
        const endTime = calculateEndTime(startTime, minutes);
        if (endTime) {
          form.setValue('end_time', endTime);
        }
      }
    }
  };

  const handleContactChange = (contactId: string) => {
    const contact = contacts.find(c => c.id === contactId);
    setSelectedContact(contact || null);
    form.setValue('client_id', contactId);

    if (contact) {
      form.setValue('cliente_nome', contact.name || '');
      form.setValue('cliente_telefone', contact.number || '');
      form.setValue('cliente_email', contact.remote_jid || '');
    }
  };

  const handleUseContactChange = (checked: boolean) => {
    setUseContact(checked);
    if (!checked) {
      form.setValue('client_id', undefined);
      setSelectedContact(null);
    }
  };

  const handleStartTimeChange = (time: string) => {
    form.setValue('start_time', time);

    // If we have a selected service with average duration, calculate end time
    if (selectedService?.tempo_medio) {
      const durationMatch = selectedService.tempo_medio.match(/(\d+)/);
      if (durationMatch) {
        const minutes = parseInt(durationMatch[0], 10);
        const endTime = calculateEndTime(time, minutes);
        if (endTime) {
          form.setValue('end_time', endTime);
        }
      }
    }
  };

  const onSubmit = async (data: FormSchema) => {
    setIsLoading(true);

    try {
      const appointmentData = {
        professional_id: data.professional_id,
        service_id: data.service_id,
        client_id: useContact && data.client_id ? data.client_id : null,
        appointment_date: format(data.appointment_date, 'yyyy-MM-dd'),
        start_time: data.start_time,
        end_time: data.end_time,
        status: data.status as AppointmentStatus,
        notes: data.notes || null,
        location: data.location || null,
        appointment_type: (data.appointment_type || 'individual') as AppointmentType,
        convenio_usado: data.convenio_usado || null,
        valor_cobrado: data.valor_cobrado || null,
        cliente_nome: data.cliente_nome,
        cliente_telefone: data.cliente_telefone || null,
        cliente_email: data.cliente_email || null,
        company_id: null, // Adicionando company_id como null por padrão
        pesquisa: `${data.cliente_nome} ${data.professional_id} ${data.service_id}`, // Gerando campo de pesquisa
      };

      if (appointmentToEdit) {
        // Update
        await updateAppointment(appointmentToEdit.id, appointmentData);
        toast({
          title: 'Agendamento atualizado',
          description: 'O agendamento foi atualizado com sucesso.',
        });
      } else {
        // Create
        await createAppointment(appointmentData);
        toast({
          title: 'Agendamento criado',
          description: 'O agendamento foi criado com sucesso.',
        });
      }

      onClose();
    } catch (error) {
      console.error('Error saving appointment:', error);
      toast({
        title: 'Erro',
        description: 'Ocorreu um erro ao salvar o agendamento.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {appointmentToEdit ? 'Editar Agendamento' : 'Novo Agendamento'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="professional_id">Profissional</Label>
              <Select
                value={form.watch('professional_id')}
                onValueChange={(value) => form.setValue('professional_id', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um profissional" />
                </SelectTrigger>
                <SelectContent>
                  {professionals.map((professional) => (
                    <SelectItem key={professional.id} value={professional.id}>
                      {professional.nome}
                      {professional.especialidade && ` (${professional.especialidade})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.professional_id && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.professional_id.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="service_id">Serviço</Label>
              <Select
                value={form.watch('service_id')}
                onValueChange={handleServiceChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um serviço" />
                </SelectTrigger>
                <SelectContent>
                  {services.map((service) => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name}
                      {service.tempo_medio && ` (${service.tempo_medio})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.service_id && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.service_id.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="useContact">Usar contato existente</Label>
              <Switch
                id="useContact"
                checked={useContact}
                onCheckedChange={handleUseContactChange}
              />
            </div>

            {useContact ? (
              <div className="space-y-2">
                <Select
                  value={form.watch('client_id')}
                  onValueChange={handleContactChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um contato" />
                  </SelectTrigger>
                  <SelectContent>
                    {contacts.map((contact) => (
                      <SelectItem key={contact.id} value={contact.id}>
                        {contact.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.client_id && (
                  <p className="text-sm text-red-500">
                    {form.formState.errors.client_id.message}
                  </p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cliente_nome">Nome do Cliente</Label>
                  <Input
                    id="cliente_nome"
                    {...form.register('cliente_nome')}
                  />
                  {form.formState.errors.cliente_nome && (
                    <p className="text-sm text-red-500">
                      {form.formState.errors.cliente_nome.message}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cliente_telefone">Telefone</Label>
                    <Input
                      id="cliente_telefone"
                      {...form.register('cliente_telefone')}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cliente_email">Email</Label>
                    <Input
                      id="cliente_email"
                      type="email"
                      {...form.register('cliente_email')}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="appointment_date">Data</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="appointment_date"
                  type="date"
                  value={form.watch('appointment_date') ? format(form.watch('appointment_date'), 'yyyy-MM-dd') : ''}
                  onChange={(e) => {
                    const date = e.target.value ? new Date(e.target.value) : null;
                    form.setValue('appointment_date', date || new Date());
                  }}
                  className="w-full"
                />
              </div>
              {form.formState.errors.appointment_date && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.appointment_date.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={form.watch('status')}
                onValueChange={(value) => form.setValue('status', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Agendado</SelectItem>
                  <SelectItem value="completed">Concluído</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                  <SelectItem value="no_show">Não Compareceu</SelectItem>
                  <SelectItem value="rescheduled">Reagendado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_time">Horário de Início</Label>
              <div className="flex items-center space-x-2">
                <Input
                  id="start_time"
                  type="time"
                  {...form.register('start_time')}
                  onChange={(e) => handleStartTimeChange(e.target.value)}
                />
              </div>
              {form.formState.errors.start_time && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.start_time.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_time">Horário de Término</Label>
              <div className="flex items-center space-x-2">
                <Input
                  id="end_time"
                  type="time"
                  {...form.register('end_time')}
                />
              </div>
              {form.formState.errors.end_time && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.end_time.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="location">Local</Label>
              <Input
                id="location"
                {...form.register('location')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="appointment_type">Tipo de Atendimento</Label>
              <Select
                value={form.watch('appointment_type') || 'individual'}
                onValueChange={(value) => form.setValue('appointment_type', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="group">Grupo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="convenio_usado">Convênio</Label>
              <Input
                id="convenio_usado"
                {...form.register('convenio_usado')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="valor_cobrado">Valor</Label>
              <Input
                id="valor_cobrado"
                type="number"
                step="0.01"
                {...form.register('valor_cobrado', { valueAsNumber: true })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              {...form.register('notes')}
            />
          </div>

          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Salvando...' : appointmentToEdit ? 'Atualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
