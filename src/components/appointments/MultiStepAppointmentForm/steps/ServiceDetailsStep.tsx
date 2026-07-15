'use client';

import React, { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AppointmentFormData } from '..';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useAgreements } from '@/contexts/Agreements';

interface ServiceDetailsStepProps {
  formData: AppointmentFormData;
  updateFormData: (data: Partial<AppointmentFormData>) => void;
  isEdit?: boolean;
}

export const ServiceDetailsStep: React.FC<ServiceDetailsStepProps> = ({
  formData,
  updateFormData,
  isEdit = false
}) => {
  const { agreements, loading: loadingAgreements } = useAgreements();
  const [isInsurance, setIsInsurance] = useState(!!formData.details.insurance);
  const [serviceType, setServiceType] = useState(formData.details.appointmentType || 'individual');
  const [price, setPrice] = useState(formData.details.price?.toString() || '');
  const [participantsCount, setParticipantsCount] = useState(formData.details.participantsCount?.toString() || '1');

  // Usar os convênios da empresa em vez de uma lista estática

  useEffect(() => {
    // Atualiza o formData quando os valores mudam
    updateFormData({
      details: {
        ...formData.details,
        appointmentType: serviceType,
        insurance: isInsurance ? formData.details.insurance || '' : undefined,
        price: price ? parseFloat(price) : undefined,
        participantsCount: serviceType === 'group' ? (participantsCount ? parseInt(participantsCount) : 1) : undefined
      }
    });
  }, [isInsurance, serviceType, price, participantsCount]);

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Permite apenas números e um ponto decimal
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setPrice(value);
    }
  };
  
  const handleParticipantsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Permite apenas números inteiros positivos
    if (value === '' || /^[1-9]\d*$/.test(value)) {
      setParticipantsCount(value);
    }
  };

  const handleInsuranceChange = (checked: boolean) => {
    setIsInsurance(checked);
    if (!checked) {
      // Se desmarcar o convênio, limpa o valor do convênio
      updateFormData({
        details: {
          ...formData.details,
          insurance: undefined
        }
      });
    }
  };

  const handleInsuranceSelect = (value: string) => {
    updateFormData({
      details: {
        ...formData.details,
        insurance: value
      }
    });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-blue-700 mb-4">Detalhes do Serviço</h2>
      
      <div className="space-y-4">
        <div>
          <Label className="text-base font-medium mb-2 block">Tipo de Atendimento</Label>
          <RadioGroup 
            value={serviceType} 
            onValueChange={setServiceType}
            className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="individual" id="individual" />
              <Label htmlFor="individual" className="font-normal">Individual</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="group" id="group" />
              <Label htmlFor="group" className="font-normal">Grupo</Label>
            </div>
          </RadioGroup>
        </div>

        <div className="grid gap-4 pt-4">
          <Card className={cn("border-2", isInsurance ? "border-blue-200" : "border-gray-100")}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <Label htmlFor="use-insurance" className="text-base font-medium">
                  Utilizar Convênio
                </Label>
                <Switch 
                  id="use-insurance" 
                  checked={isInsurance}
                  onCheckedChange={handleInsuranceChange}
                />
              </div>
              
              {isInsurance && (
                <div className="mt-4">
                  <Label htmlFor="insurance-select" className="mb-2 block">
                    Selecione o Convênio
                  </Label>
                  <Select 
                    value={formData.details.insurance || ''} 
                    onValueChange={handleInsuranceSelect}
                  >
                    <SelectTrigger id="insurance-select" className="w-full">
                      <SelectValue placeholder="Selecione um convênio" />
                    </SelectTrigger>
                    <SelectContent>
                      {loadingAgreements ? (
                        <SelectItem value="loading" disabled>Carregando convênios...</SelectItem>
                      ) : agreements.length > 0 ? (
                        agreements.map(agreement => (
                          <SelectItem key={agreement.id} value={agreement.id}>
                            {agreement.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="none" disabled>Nenhum convênio disponível</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Campo de quantidade de participantes (apenas para serviços em grupo) */}
        {serviceType === 'group' && (
          <div className="pt-4">
            <Label htmlFor="participants" className="text-base font-medium mb-2 block">
              Quantidade de Participantes
            </Label>
            <Input
              id="participants"
              type="text"
              value={participantsCount}
              onChange={handleParticipantsChange}
              placeholder="1"
              className="w-full"
            />
            <p className="text-sm text-gray-500 mt-1">
              Informe o número de pessoas que participarão da sessão em grupo
            </p>
          </div>
        )}
        
        <div className="pt-4">
          <Label htmlFor="price" className="text-base font-medium mb-2 block">
            Valor do Serviço (R$)
          </Label>
          <Input
            id="price"
            type="text"
            value={price}
            onChange={handlePriceChange}
            placeholder="0,00"
            className="w-full"
          />
          <p className="text-sm text-gray-500 mt-1">
            {isInsurance 
              ? 'Informe o valor da sessão cobrado do convênio' 
              : 'Informe o valor a ser cobrado do cliente'}
          </p>
        </div>
      </div>
    </div>
  );
};
