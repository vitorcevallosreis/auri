'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { ClientStep } from './steps/ClientStep';
import { ProfessionalStep } from './steps/ProfessionalStep';
import { ServiceStep } from './steps/ServiceStep';
import { ServiceDetailsStep } from './steps/ServiceDetailsStep';
import { DateTimeStep } from './steps/DateTimeStep';
import { AdditionalOptionsStep } from './steps/AdditionalOptionsStep';
import { ConfirmationStep } from './steps/ConfirmationStep';
import { Appointment, AppointmentStatus, AppointmentType } from '@/contexts/Appointments/interfaces';
import { useAppointments } from '@/contexts/Appointments';
import { supabase } from '@/lib/supabase/config';
import { AuthContext } from '@/contexts/Auth';
import { StepIndicator } from './StepIndicator';

interface MultiStepAppointmentFormProps {
  isOpen: boolean;
  onClose: () => void;
  appointmentToEdit?: Appointment | null;
}

export interface AppointmentFormData {
  client: {
    id?: string;
    name: string;
    phone?: string;
    email?: string;
  };
  professional: {
    id: string;
    name: string;
  };
  service: {
    id: string;
    name: string;
    duration?: number;
  };
  dateTime: {
    date: Date | undefined;
    startTime: string;
    endTime: string;
  };
  details: {
    status: string;
    location?: string;
    appointmentType?: string;
    insurance?: string;
    price?: number;
    participantsCount?: number;
  };
  additionalOptions?: {
    sendNotification?: boolean;
    isRecurring?: boolean;
    recurrenceType?: string;
    sessionsCount?: number;
    endDate?: Date;
  };
  notes?: string;
  dateTimeConflicts?: Array<{
    dataFormatada: string;
    horaInicio: string;
    horaFim: string;
  }>;
}

export const MultiStepAppointmentForm: React.FC<MultiStepAppointmentFormProps> = ({
  isOpen,
  onClose,
  appointmentToEdit
}) => {
  const { createAppointment, updateAppointment } = useAppointments();
  const { user } = React.useContext(AuthContext);
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [formData, setFormData] = useState<AppointmentFormData>({
    client: {
      name: appointmentToEdit?.cliente_nome || '',
      phone: appointmentToEdit?.cliente_telefone || '',
      email: appointmentToEdit?.cliente_email || '',
      id: appointmentToEdit?.client_id || undefined,
    },
    professional: {
      id: appointmentToEdit?.professional_id || '',
      name: appointmentToEdit?.professional_name || '',
    },
    service: {
      id: appointmentToEdit?.service_id || '',
      name: appointmentToEdit?.service_name || '',
    },
    dateTime: {
      date: appointmentToEdit ? new Date(appointmentToEdit.appointment_date) : new Date(),
      startTime: appointmentToEdit?.start_time || '',
      endTime: appointmentToEdit?.end_time || '',
    },
    details: {
      status: appointmentToEdit?.status || 'scheduled',
      location: appointmentToEdit?.location || '',
      appointmentType: appointmentToEdit?.appointment_type || 'individual',
      insurance: appointmentToEdit?.convenio_usado || '',
      price: appointmentToEdit?.valor_cobrado || undefined,
    },
    additionalOptions: {
      sendNotification: true,
      isRecurring: false,
      recurrenceType: 'sessions',
      sessionsCount: 1
    },
    notes: appointmentToEdit?.notes || ''
  });

  useEffect(() => {
    if (appointmentToEdit) {
      setFormData({
        client: {
          id: appointmentToEdit.client_id || '',
          name: appointmentToEdit.cliente_nome || '',
          phone: appointmentToEdit.cliente_telefone || '',
          email: appointmentToEdit.cliente_email || ''
        },
        professional: {
          id: appointmentToEdit.professional_id || '',
          name: appointmentToEdit.professional_name || ''
        },
        service: {
          id: appointmentToEdit.service_id || '',
          name: appointmentToEdit.service_name || ''
        },
        dateTime: {
          date: appointmentToEdit.appointment_date ? new Date(appointmentToEdit.appointment_date) : undefined,
          startTime: appointmentToEdit.start_time || '',
          endTime: appointmentToEdit.end_time || ''
        },
        details: {
          status: appointmentToEdit.status || '',
          price: appointmentToEdit.valor_cobrado ?? undefined,
          insurance: appointmentToEdit.convenio_usado ?? undefined,
          appointmentType: appointmentToEdit.appointment_type ?? undefined,
          participantsCount: undefined // ajuste conforme seu modelo se necessário
        },
        additionalOptions: {
          sendNotification: true,
          isRecurring: false,
          recurrenceType: 'sessions',
          sessionsCount: 1
        },
        notes: appointmentToEdit.notes || ''
      });
      setCurrentStep(0); // Volta para o início do wizard ao editar
    } else {
      // Se for novo agendamento, limpa o formulário
      setFormData({
        client: { name: '', phone: '', email: '', id: '' },
        professional: { id: '', name: '' },
        service: { id: '', name: '' },
        dateTime: { date: undefined, startTime: '', endTime: '' },
        details: { status: '', price: undefined, insurance: undefined, appointmentType: undefined, participantsCount: undefined },
        additionalOptions: {
          sendNotification: true,
          isRecurring: false,
          recurrenceType: 'sessions',
          sessionsCount: 1
        },
        notes: ''
      });
      setCurrentStep(0);
    }
  }, [appointmentToEdit, isOpen]);

  const steps = [
    { title: 'Cliente', component: ClientStep },
    { title: 'Profissional', component: ProfessionalStep },
    { title: 'Serviço', component: ServiceStep },
    { title: 'Detalhes do Serviço', component: ServiceDetailsStep },
    { title: 'Data e Hora', component: DateTimeStep },
    { title: 'Opções Adicionais', component: AdditionalOptionsStep },
    { title: 'Confirmação', component: ConfirmationStep },
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Usar useRef para armazenar o último estado do formulário para comparação
  const lastFormDataRef = useRef<AppointmentFormData>(formData);
  
  // Usar useCallback para criar uma função estável que não muda a cada renderização
  const updateFormData = useCallback((stepData: Partial<AppointmentFormData>) => {
    // Sempre atualizar sem verificar mudanças para propriedades especiais
    if ('dateTimeConflicts' in stepData) {
      setFormData(prev => {
        const newData = {
          ...prev,
          ...stepData
        };
        lastFormDataRef.current = newData;
        return newData;
      });
      return;
    }
    
    // Para outras propriedades, verificar se os dados realmente mudaram antes de atualizar
    let hasChanged = false;
    const keys = Object.keys(stepData) as Array<keyof AppointmentFormData>;
    
    for (const key of keys) {
      // Se for um objeto, verificar se alguma propriedade mudou
      if (typeof stepData[key] === 'object' && stepData[key] !== null) {
        // Verificar se a propriedade existe no estado atual
        if (!lastFormDataRef.current[key]) {
          hasChanged = true;
          break;
        }
        
        const subKeys = Object.keys(stepData[key] as object);
        for (const subKey of subKeys) {
          // Verificar se a subpropriedade existe e se o valor mudou
          if (!(lastFormDataRef.current[key] as any) || 
              (stepData[key] as any)[subKey] !== (lastFormDataRef.current[key] as any)[subKey]) {
            hasChanged = true;
            break;
          }
        }
      } else if (stepData[key] !== lastFormDataRef.current[key]) {
        hasChanged = true;
        break;
      }
    }
    
    // Só atualizar se algo realmente mudou
    if (hasChanged) {
      setFormData(prev => {
        const newData = {
          ...prev,
          ...stepData
        };
        lastFormDataRef.current = newData;
        return newData;
      });
    }
  }, []);

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      // Gerar um ID temporário para o agendamento
      const tempAppointmentId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

      // Transformar os dados do formulário para o formato esperado pela API
      const appointmentData = {
        professional_id: formData.professional.id,
        service_id: formData.service.id,
        client_id: formData.client.id || null,
        appointment_date: formData.dateTime.date ? formData.dateTime.date.toISOString().split('T')[0] : '',
        start_time: formData.dateTime.startTime,
        end_time: formData.dateTime.endTime,
        status: formData.details.status as AppointmentStatus,
        notes: formData.notes || null,
        location: formData.details.location || null,
        appointment_type: formData.details.appointmentType as AppointmentType,
        convenio_usado: formData.details.insurance || null,
        valor_cobrado: formData.details.price || null,
        cliente_nome: formData.client.name,
        cliente_telefone: formData.client.phone || null,
        cliente_email: formData.client.email || null,
        company_id: user?.company_id || null, // Usando o company_id do usuário logado
        pesquisa: null, // Usando null em vez de string vazia
        temp_id: tempAppointmentId // ID temporário para associar arquivos
      };

      
      // O fluxo antigo delegava a gravação E a checagem de conflito a um
      // webhook do n8n (webhooks.sejanexa.com.br). Esse host não responde mais
      // (o DNS resolve, o TCP não conecta), então o `await fetch` estourava e o
      // agendamento NUNCA era criado — o formulário só sabia falhar. Pior:
      // `createAppointment` já estava importado e o payload já vinha montado,
      // mas a função nunca era chamada.
      //
      // A checagem de conflito cobre o caso objetivo: mesmo profissional, mesma
      // data, faixas de horário que se sobrepõem, ignorando cancelados. Regras
      // mais ricas que o n8n possa ter tido (bloqueios de agenda, feriados,
      // intervalos entre consultas) NÃO foram reconstruídas — não há como
      // inferi-las a partir do código que sobrou.
      const { data: conflitos, error: erroConflito } = await supabase
        .from("myia_appointments")
        .select("id, start_time, end_time, cliente_nome")
        .eq("professional_id", appointmentData.professional_id)
        .eq("appointment_date", appointmentData.appointment_date)
        .neq("status", "cancelled")
        .lt("start_time", appointmentData.end_time)
        .gt("end_time", appointmentData.start_time);

      if (erroConflito) {
        console.error("Falha ao verificar conflitos de horário:", erroConflito);
        toast({
          title: "Não foi possível verificar a agenda",
          description: "Tente novamente em instantes.",
          variant: "destructive",
        });
        return;
      }

      if (conflitos && conflitos.length > 0) {
        const lista = conflitos
          .map((c: any) => `${c.start_time?.slice(0, 5)}–${c.end_time?.slice(0, 5)}${c.cliente_nome ? ` (${c.cliente_nome})` : ""}`)
          .join(", ");
        toast({
          title: "Conflito de horário",
          description: `Este profissional já tem agendamento neste intervalo: ${lista}.`,
          variant: "destructive",
        });
        return;
      }

      // `temp_id` NÃO existe em myia_appointments (ver migration 0006) — era um
      // campo só do payload do n8n, para associar anexos. Mandá-lo no insert
      // faria o PostgREST rejeitar a linha inteira.
      const { temp_id: _tempId, ...dadosParaBanco } = appointmentData;

      const criado = await createAppointment(dadosParaBanco as any);

      if (!criado) {
        toast({
          title: "Erro ao realizar agendamento",
          description: "Não foi possível salvar o agendamento. Tente novamente.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Agendamento realizado com sucesso!",
        description: `${appointmentData.cliente_nome} • ${appointmentData.start_time?.slice(0, 5)}`,
        variant: "default",
      });

      onClose();
    } catch (error) {
      console.error('Erro ao criar agendamento:', error);
      toast({
        title: "Erro ao realizar agendamento",
        description: "Ocorreu um erro ao processar sua solicitação. Por favor, tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const CurrentStepComponent = steps[currentStep].component;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] md:max-w-[900px] max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader className="pb-4 border-b">
          <DialogTitle className="text-xl font-bold text-primary">
            {appointmentToEdit ? 'Editar Agendamento' : 'Novo Agendamento'}
          </DialogTitle>
        </DialogHeader>

        <StepIndicator 
          steps={steps.map(s => s.title)} 
          currentStep={currentStep} 
          onStepClick={(step: number) => setCurrentStep(step)} 
        />

        <div className="py-6">
          <div className="bg-card rounded-lg p-4 shadow-sm border">
            <CurrentStepComponent 
              formData={formData} 
              updateFormData={updateFormData} 
              isEdit={!!appointmentToEdit}
            />
          </div>
        </div>

        <div className="flex justify-between mt-6 pt-4 border-t">
          <Button
            variant="outline"
            size="lg"
            className="px-6"
            onClick={currentStep === 0 ? onClose : handlePrevious}
            disabled={isLoading}
          >
            {currentStep === 0 ? 'Cancelar' : (
              <>
                <ChevronLeft className="mr-2 h-5 w-5" />
                Anterior
              </>
            )}
          </Button>

          {currentStep < steps.length - 1 ? (
            <Button 
              onClick={handleNext} 
              disabled={isLoading}
              size="lg"
              className="px-6 bg-primary hover:bg-primary/90"
            >
              Próximo
              <ChevronRight className="ml-2 h-5 w-5" />
            </Button>
          ) : (
            <Button 
              onClick={handleSubmit} 
              disabled={isLoading}
              size="lg"
              className="px-6 bg-primary hover:bg-primary/90"
            >
              {isLoading ? 'Salvando...' : (
                <>
                  Confirmar
                  <Check className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
