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

      // Preparar os dados para o webhook independentemente do resultado do banco
      const webhookData = {
        company_id: user?.company_id || null, // Adicionando company_id para o webhook
        professional_id: formData.professional.id,
        professional_name: formData.professional.name,
        service_id: formData.service.id,
        service_name: formData.service.name,
        service_duration: formData.service.duration,
        service_price: formData.details.price || 0,
        client_id: formData.client.id || null,
        client_name: formData.client.name,
        client_phone: formData.client.phone || null,
        client_email: formData.client.email || null,
        appointment_date: formData.dateTime.date ? formData.dateTime.date.toISOString().split('T')[0] : '',
        start_time: formData.dateTime.startTime,
        end_time: formData.dateTime.endTime,
        status: formData.details.status || 'scheduled',
        notes: formData.notes || '',
        location: formData.details.location || '',
        appointment_type: formData.details.appointmentType || 'in-person',
        service_modality: formData.details.appointmentType || 'individual', // Tipo de serviço: individual ou grupo
        participants_count: formData.details.participantsCount || 1, // Quantidade de participantes (para serviços em grupo)
        insurance: formData.details.insurance || null, // Convênio utilizado
        price: formData.details.price || 0, // Valor do serviço
        send_notification: formData.additionalOptions?.sendNotification || true,
        is_recurring: formData.additionalOptions?.isRecurring || false,
        recurrence_type: formData.additionalOptions?.isRecurring ? formData.additionalOptions.recurrenceType : null,
        sessions_count: formData.additionalOptions?.isRecurring && formData.additionalOptions.recurrenceType === 'sessions' ? formData.additionalOptions.sessionsCount : null,
        end_date: formData.additionalOptions?.isRecurring && formData.additionalOptions.recurrenceType === 'date' && formData.additionalOptions.endDate ? formData.additionalOptions.endDate.toISOString().split('T')[0] : null,
        has_attachments: false,
        temp_id: tempAppointmentId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      // Enviar para o webhook
      console.log('Enviando dados para o webhook:', webhookData);
      
      const webhookResponse = await fetch('https://webhooks.sejanexa.com.br/webhook/created-schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(webhookData)
      });
      
      // Processar a resposta do webhook
      const responseData = await webhookResponse.json();
      
      // Verificar se há conflitos de horário
      if (!webhookResponse.ok || (responseData && responseData.status === false)) {
        // Se houver conflitos, exibir mensagem para o usuário
        if (responseData && responseData.conflitos && responseData.conflitos.length > 0) {
          // Verificar se a resposta contém conflitos válidos
          if (!Array.isArray(responseData.conflitos) || responseData.conflitos.length === 0) {
            console.error('Resposta de conflito inválida:', responseData);
            toast({
              title: "Erro ao processar conflitos de horário",
              description: "Ocorreu um erro ao processar os conflitos de horário. Por favor, tente novamente.",
              variant: "destructive",
            });
            return;
          }
          
          // Formatar os conflitos para exibição
          const conflitosFormatados = responseData.conflitos.map((conflito: any) => {
            try {
              // Formatar a data para o formato brasileiro
              // Corrigir o problema de fuso horário adicionando o T00:00:00 e tratando como data local
              const dataStr = conflito.data.includes('T') ? conflito.data : `${conflito.data}T00:00:00`;
              
              // Extrair os componentes da data diretamente da string para evitar problemas de fuso horário
              const [ano, mes, dia] = dataStr.split('T')[0].split('-').map(Number);
              
              if (!ano || !mes || !dia || isNaN(ano) || isNaN(mes) || isNaN(dia)) {
                throw new Error(`Data inválida: ${conflito.data}`);
              }
              
              // Formatar a data manualmente para garantir que não há problemas de fuso horário
              const dataFormatada = `${dia.toString().padStart(2, '0')}/${mes.toString().padStart(2, '0')}/${ano}`;
              
              // Formatar os horários (remover os segundos)
              const horaInicio = conflito.start_time ? conflito.start_time.substring(0, 5) : '00:00';
              const horaFim = conflito.end_time ? conflito.end_time.substring(0, 5) : '00:00';
              
              return { dataFormatada, horaInicio, horaFim };
            } catch (error) {
              console.error('Erro ao formatar conflito:', error, conflito);
              return { 
                dataFormatada: 'Data inválida', 
                horaInicio: conflito.start_time || '00:00', 
                horaFim: conflito.end_time || '00:00' 
              };
            }
          });
          
          // Exibir toast com os conflitos
          toast({
            title: "Conflito de horários detectado",
            description: (
              <div className="space-y-2">
                <p className="font-medium text-red-800">{responseData.message || "Existem conflitos de horário na sua solicitação."}</p>
                <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="font-medium text-red-800 mb-2">Horários com conflito:</p>
                  <ul className="list-disc pl-5 text-sm text-red-700 space-y-1">
                    {conflitosFormatados.map((conflito: { dataFormatada: string; horaInicio: string; horaFim: string }, index: number) => (
                      <li key={index}>
                        <span className="font-medium">{conflito.dataFormatada}</span> das <span className="font-medium">{conflito.horaInicio}</span> às <span className="font-medium">{conflito.horaFim}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-sm font-medium text-red-700">Por favor, selecione outro horário ou data para o agendamento.</p>
                </div>
              </div>
            ),
            variant: "destructive",
            duration: 15000, // Aumentar a duração para dar tempo de ler
          });
          
          // Criar um alerta visual na etapa de data/hora
          const dateTimeStepIndex = steps.findIndex(step => step.title === 'Data e Hora');
          if (dateTimeStepIndex !== -1) {
            // Adicionar uma mensagem de alerta ao estado do formulário
            // Garantir que os conflitos formatados sejam válidos
            if (conflitosFormatados && conflitosFormatados.length > 0) {
              // Usar um setTimeout para garantir que a atualização do estado ocorra após a renderização atual
              setTimeout(() => {
                updateFormData({
                  dateTimeConflicts: [...conflitosFormatados]
                });
              }, 0);
            }
            
            // Voltar para a etapa de seleção de data/hora
            setCurrentStep(dateTimeStepIndex);
            
            // Mostrar um alerta adicional para garantir que o usuário entenda o que aconteceu
            setTimeout(() => {
              toast({
                title: "Selecione uma nova data ou horário",
                description: "Você foi redirecionado para a etapa de seleção de data e hora para escolher um novo horário disponível.",
                variant: "default",
                duration: 5000,
              });
            }, 1000); // Pequeno atraso para garantir que o usuário veja esta mensagem após a primeira
          }
        } else {
          // Se não houver detalhes de conflitos, mostrar mensagem genérica de erro
          console.error('Falha ao notificar o servidor de agendamentos:', webhookResponse.status, responseData);
          toast({
            title: "Erro ao realizar agendamento",
            description: responseData.message || "Ocorreu um erro ao processar sua solicitação. Por favor, tente novamente.",
            variant: "destructive",
          });
        }
      } else {
        // Sucesso - agendamento realizado
        console.log('Webhook notificado com sucesso!');
        
        // Mostrar feedback de sucesso para o usuário
        toast({
          title: "Agendamento realizado com sucesso!",
          description: "Os detalhes foram enviados para processamento.",
          variant: "default",
        });
        
        onClose();
      }
    } catch (error) {
      console.error('Erro ao enviar para webhook:', error);
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
          <DialogTitle className="text-xl font-bold text-[#00897B]">
            {appointmentToEdit ? 'Editar Agendamento' : 'Novo Agendamento'}
          </DialogTitle>
        </DialogHeader>

        <StepIndicator 
          steps={steps.map(s => s.title)} 
          currentStep={currentStep} 
          onStepClick={(step: number) => setCurrentStep(step)} 
        />

        <div className="py-6">
          <div className="bg-white rounded-lg p-4 shadow-sm border">
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
              className="px-6 bg-[#00897B] hover:bg-[#00796B]"
            >
              Próximo
              <ChevronRight className="ml-2 h-5 w-5" />
            </Button>
          ) : (
            <Button 
              onClick={handleSubmit} 
              disabled={isLoading}
              size="lg"
              className="px-6 bg-[#00897B] hover:bg-[#00796B]"
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
