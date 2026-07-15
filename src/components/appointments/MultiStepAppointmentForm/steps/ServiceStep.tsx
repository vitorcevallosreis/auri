'use client';

import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '@/contexts/Auth';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, Clock, DollarSign } from 'lucide-react';
import { supabase } from '@/lib/supabase/config';
import { AppointmentFormData } from '..';
import { Badge } from '@/components/ui/badge';

interface Service {
  id: string;
  name: string;
  tempo_medio?: string; // Na tabela é text, não number
  price?: number;
  description?: string;
}

interface ServiceStepProps {
  formData: AppointmentFormData;
  updateFormData: (data: Partial<AppointmentFormData>) => void;
  isEdit: boolean;
}

export const ServiceStep: React.FC<ServiceStepProps> = ({
  formData,
  updateFormData,
  isEdit
}) => {
  const [services, setServices] = useState<Service[]>([]);
  const [filteredServices, setFilteredServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState<string>(formData.service.id || '');
  const { user } = useContext(AuthContext);
  
  // Buscar serviços disponíveis para o profissional selecionado
  useEffect(() => {
    const fetchServices = async () => {
      if (!formData.professional.id) return;
      
      setIsLoading(true);
      try {
        // Primeiro, verificamos os serviços que o profissional está disponível para realizar
        const { data: availabilityData, error: availabilityError } = await supabase
          .from('myia_professional_availability')
          .select('service_id')
          .eq('professional_id', formData.professional.id)
          .eq('active', true)
          .is('is_available', true);
        
        if (availabilityError) {
          throw availabilityError;
        }
        
        // Extrair IDs de serviço únicos
        const serviceIds = Array.from(
          new Set(availabilityData?.map(a => a.service_id).filter(Boolean) || [])
        );
        
        // Verificar se temos o company_id do usuário
        if (!user?.company_id) {
          console.error('Company ID não disponível');
          return;
        }
        
        // Se o profissional não tiver serviços específicos na disponibilidade,
        // buscamos todos os serviços da empresa do usuário
        let query = supabase
          .from('myia_services')
          .select('id, name, tempo_medio, price, description')
          .eq('company_id', user.company_id);
        
        if (serviceIds.length > 0) {
          query = query.in('id', serviceIds);
        }
        
        const { data, error } = await query;
        
        if (error) {
          throw error;
        }
        
        setServices(data || []);
        setFilteredServices(data || []);
        
      } catch (error) {
        console.error('Erro ao buscar serviços:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchServices();
  }, [formData.professional.id]);

  // Filtrar serviços quando a busca mudar
  useEffect(() => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const filtered = services.filter(s => 
        s.name?.toLowerCase().includes(query) || 
        s.description?.toLowerCase().includes(query)
      );
      setFilteredServices(filtered);
    } else {
      setFilteredServices(services);
    }
  }, [searchQuery, services]);

  // Atualizar dados do formulário quando o serviço selecionado mudar
  useEffect(() => {
    if (selectedServiceId) {
      const selectedService = services.find(s => s.id === selectedServiceId);
      if (selectedService && 
          (selectedService.id !== formData.service.id || 
           selectedService.name !== formData.service.name || 
           selectedService.tempo_medio !== formData.service.duration)) {
        // Converter tempo_medio de string para number se possível
        let duration: number | undefined = undefined;
        if (selectedService.tempo_medio) {
          // Tentar extrair números da string
          const match = selectedService.tempo_medio.match(/\d+/);
          if (match) {
            duration = parseInt(match[0], 10);
          }
        }
        
        updateFormData({
          service: {
            id: selectedService.id,
            name: selectedService.name,
            duration: duration
          }
        });
      }
    }
  }, [selectedServiceId, services, updateFormData, formData.service.id, formData.service.name, formData.service.duration]);

  const handleServiceSelect = (serviceId: string) => {
    setSelectedServiceId(serviceId);
  };



  const formatCurrency = (value?: number) => {
    if (value === undefined) return '';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar procedimento ou consulta"
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="border rounded-md max-h-64 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-gray-500">Carregando...</div>
          ) : filteredServices.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              Nenhum procedimento disponível para este profissional.
            </div>
          ) : (
            <div className="divide-y">
              {filteredServices.map((service) => (
                <div
                  key={service.id}
                  className={`p-3 hover:bg-gray-50 cursor-pointer ${
                    selectedServiceId === service.id ? 'bg-teal-50 border-l-4 border-[#00897B]' : ''
                  }`}
                  onClick={() => handleServiceSelect(service.id)}
                >
                  <div className="flex justify-between">
                    <div className="font-medium">{service.name}</div>
                    {service.price !== undefined && (
                      <div className="text-sm font-medium text-[#00897B]">
                        {formatCurrency(service.price)}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center mt-1 text-sm text-gray-500">
                    {service.tempo_medio && (
                      <div className="flex items-center mr-3">
                        <Clock className="h-3.5 w-3.5 mr-1" />
                        {service.tempo_medio}
                      </div>
                    )}
                    

                  </div>
                  
                  {service.description && (
                    <div className="mt-2 text-sm text-gray-600">
                      {service.description}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
