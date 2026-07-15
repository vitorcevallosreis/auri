'use client';

import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AppointmentFormData } from '..';
import { 
  CalendarClock, 
  User, 
  UserCheck, 
  Briefcase, 
  Clock, 
  Calendar, 
  CreditCard, 
  Users, 
  DollarSign, 
  UserPlus, 
  Bell, 
  Repeat, 
  Check, 
  X 
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAgreements } from '@/contexts/Agreements';

interface ConfirmationStepProps {
  formData: AppointmentFormData;
  updateFormData: (data: Partial<AppointmentFormData>) => void;
  isEdit: boolean;
}

export const ConfirmationStep: React.FC<ConfirmationStepProps> = ({
  formData,
  updateFormData,
  isEdit
}) => {
  const { agreements } = useAgreements();
  const [insuranceName, setInsuranceName] = useState<string>('');
  const formatTime = (timeString?: string) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    return `${hours}:${minutes}`;
  };
  
  // Buscar o nome do convênio pelo ID
  useEffect(() => {
    if (formData.details.insurance && agreements.length > 0) {
      const agreement = agreements.find(a => a.id === formData.details.insurance);
      if (agreement) {
        setInsuranceName(agreement.name);
      } else {
        setInsuranceName('Convênio não encontrado');
      }
    } else if (!formData.details.insurance) {
      setInsuranceName('Particular');
    }
  }, [formData.details.insurance, agreements]);

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateFormData({
      notes: e.target.value
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
        <h3 className="text-lg font-medium text-blue-800 flex items-center mb-3">
          <CalendarClock className="mr-2 h-5 w-5" />
          Resumo do Agendamento
        </h3>
        
        <div className="space-y-4">
          {/* Cliente */}
          <div className="flex items-start">
            <User className="h-5 w-5 text-gray-500 mr-3 mt-0.5" />
            <div>
              <div className="text-sm font-medium text-gray-700">Cliente</div>
              <div className="text-base">{formData.client.name}</div>
              {formData.client.phone && (
                <div className="text-sm text-gray-600">{formData.client.phone}</div>
              )}
              {formData.client.email && (
                <div className="text-sm text-gray-600">{formData.client.email}</div>
              )}
            </div>
          </div>
          
          {/* Profissional */}
          <div className="flex items-start">
            <UserCheck className="h-5 w-5 text-gray-500 mr-3 mt-0.5" />
            <div>
              <div className="text-sm font-medium text-gray-700">Profissional</div>
              <div className="text-base">{formData.professional.name}</div>
            </div>
          </div>
          
          {/* Serviço */}
          <div className="flex items-start">
            <Briefcase className="h-5 w-5 text-gray-500 mr-3 mt-0.5" />
            <div>
              <div className="text-sm font-medium text-gray-700">Serviço</div>
              <div className="text-base">{formData.service.name}</div>
              {formData.service.duration && (
                <div className="text-sm text-gray-600 flex items-center mt-1">
                  <Clock className="h-3.5 w-3.5 mr-1" />
                  Duração: {formData.service.duration} minutos
                </div>
              )}
            </div>
          </div>
          
          {/* Detalhes do Serviço */}
          <div className="flex items-start">
            <Users className="h-5 w-5 text-gray-500 mr-3 mt-0.5" />
            <div>
              <div className="text-sm font-medium text-gray-700">Modalidade</div>
              <div className="text-base">
                {formData.details.appointmentType === 'individual' ? 'Individual' : 'Grupo'}
                {formData.details.appointmentType === 'group' && formData.details.participantsCount && (
                  <div className="text-sm text-gray-600 flex items-center mt-1">
                    <UserPlus className="h-3.5 w-3.5 mr-1" />
                    {formData.details.participantsCount} participante{formData.details.participantsCount > 1 ? 's' : ''}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Convênio */}
          <div className="flex items-start">
            <CreditCard className="h-5 w-5 text-gray-500 mr-3 mt-0.5" />
            <div>
              <div className="text-sm font-medium text-gray-700">Convênio</div>
              <div className="text-base">
                {insuranceName || 'Carregando...'}                
              </div>
            </div>
          </div>
          
          {/* Valor */}
          <div className="flex items-start">
            <DollarSign className="h-5 w-5 text-gray-500 mr-3 mt-0.5" />
            <div>
              <div className="text-sm font-medium text-gray-700">Valor</div>
              <div className="text-base">
                {formData.details.price
                  ? `R$ ${formData.details.price.toFixed(2).replace('.', ',')}`
                  : 'Não informado'}
              </div>
            </div>
          </div>
          
          {/* Data e Hora */}
          {formData.dateTime.date && (
            <div className="flex items-start">
              <Calendar className="h-5 w-5 text-gray-500 mr-3 mt-0.5" />
              <div>
                <div className="text-sm font-medium text-gray-700">Data e Horário</div>
                <div className="text-base">
                  {format(formData.dateTime.date, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </div>
                {formData.dateTime.startTime && formData.dateTime.endTime && (
                  <div className="text-sm text-gray-600">
                    {formatTime(formData.dateTime.startTime)} às {formatTime(formData.dateTime.endTime)}
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Opções Adicionais */}
          <div className="border-t border-blue-200 mt-4 pt-4">
            <h4 className="text-base font-medium text-blue-700 mb-3">Opções Adicionais</h4>
            
            {/* Notificação */}
            <div className="flex items-start mb-3">
              <Bell className="h-5 w-5 text-gray-500 mr-3 mt-0.5" />
              <div>
                <div className="text-sm font-medium text-gray-700">Notificação ao Cliente</div>
                <div className="flex items-center mt-1">
                  {formData.additionalOptions?.sendNotification ? (
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100 flex items-center">
                      <Check className="h-3.5 w-3.5 mr-1" />
                      Notificação ativada
                    </Badge>
                  ) : (
                    <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100 flex items-center">
                      <X className="h-3.5 w-3.5 mr-1" />
                      Notificação desativada
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            
            {/* Agendamento Recorrente */}
            <div className="flex items-start mb-3">
              <Repeat className="h-5 w-5 text-gray-500 mr-3 mt-0.5" />
              <div>
                <div className="text-sm font-medium text-gray-700">Agendamento Recorrente</div>
                <div className="flex items-center mt-1">
                  {formData.additionalOptions?.isRecurring ? (
                    <>
                      <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 flex items-center">
                        <Check className="h-3.5 w-3.5 mr-1" />
                        Agendamento recorrente
                      </Badge>
                      <span className="mx-2 text-gray-500">•</span>
                      {formData.additionalOptions.recurrenceType === 'sessions' ? (
                        <span className="text-sm text-gray-600">
                          {formData.additionalOptions.sessionsCount} sessões
                        </span>
                      ) : (
                        <span className="text-sm text-gray-600">
                          Até {formData.additionalOptions.endDate ? 
                            format(formData.additionalOptions.endDate, "dd/MM/yyyy") : 
                            'data não definida'}
                        </span>
                      )}
                    </>
                  ) : (
                    <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100 flex items-center">
                      <X className="h-3.5 w-3.5 mr-1" />
                      Agendamento único
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            

          </div>
        </div>
      </div>
      
      {/* Observações */}
      <div className="space-y-2">
        <Label htmlFor="notes">Observações (opcional)</Label>
        <Textarea
          id="notes"
          placeholder="Adicione informações adicionais sobre o agendamento..."
          value={formData.notes || ''}
          onChange={handleNotesChange}
          rows={4}
        />
      </div>
    </div>
  );
};
