'use client';

import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '@/contexts/Auth';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, UserCog, CheckCircle, Filter, Stethoscope, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase/config';
import { AppointmentFormData } from '..';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Professional {
  id: string;
  nome: string;
  formacao?: string;
  especialidade?: string;
  registro?: string;
  email?: string;
  telefone?: string;
}

interface ProfessionalStepProps {
  formData: AppointmentFormData;
  updateFormData: (data: Partial<AppointmentFormData>) => void;
  isEdit: boolean;
}

export const ProfessionalStep: React.FC<ProfessionalStepProps> = ({
  formData,
  updateFormData,
  isEdit
}) => {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [filteredProfessionals, setFilteredProfessionals] = useState<Professional[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string>(formData.professional.id || '');
  const [especialidades, setEspecialidades] = useState<string[]>([]);
  const [selectedEspecialidade, setSelectedEspecialidade] = useState<string>('all');
  const { user } = useContext(AuthContext);

  // Buscar profissionais
  useEffect(() => {
    const fetchProfessionals = async () => {
      setIsLoading(true);
      try {
        // Verificar se temos o company_id do usuário
        if (!user?.company_id) {
          console.error('Company ID não disponível');
          return;
        }

        const { data, error } = await supabase
          .from('myia_professionals_medical')
          .select('id, nome, formacao, especialidade, registro, email, telefone')
          .eq('company_id', user.company_id);
        
        if (error) {
          throw error;
        }
        
        setProfessionals(data || []);
        setFilteredProfessionals(data || []);
        
        // Extrair especialidades únicas
        const uniqueEspecialidades = Array.from(
          new Set(data?.map(p => p.especialidade).filter(Boolean) || [])
        );
        setEspecialidades(uniqueEspecialidades as string[]);
        
      } catch (error) {
        console.error('Erro ao buscar profissionais:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchProfessionals();
  }, []);

  // Filtrar profissionais quando a busca ou especialidade mudar
  useEffect(() => {
    let filtered = [...professionals];
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.nome?.toLowerCase().includes(query) || 
        p.especialidade?.toLowerCase().includes(query) ||
        p.formacao?.toLowerCase().includes(query)
      );
    }
    
    if (selectedEspecialidade && selectedEspecialidade !== 'all') {
      filtered = filtered.filter(p => p.especialidade === selectedEspecialidade);
    }
    
    setFilteredProfessionals(filtered);
  }, [searchQuery, selectedEspecialidade, professionals]);

  // Atualizar dados do formulário quando o profissional selecionado mudar
  useEffect(() => {
    if (selectedProfessionalId) {
      const selectedProfessional = professionals.find(p => p.id === selectedProfessionalId);
      if (selectedProfessional && 
          (selectedProfessional.id !== formData.professional.id || 
           selectedProfessional.nome !== formData.professional.name)) {
        updateFormData({
          professional: {
            id: selectedProfessional.id,
            name: selectedProfessional.nome
          }
        });
      }
    }
  }, [selectedProfessionalId, professionals, updateFormData, formData.professional.id, formData.professional.name]);

  const handleProfessionalSelect = (professionalId: string) => {
    setSelectedProfessionalId(professionalId);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
        <div className="bg-teal-50 p-4 border-b dark:bg-teal-500/10">
          <h3 className="text-base font-medium text-primary flex items-center">
            <Stethoscope className="mr-2 h-5 w-5" />
            Selecione o médico ou profissional
          </h3>
        </div>
        
        <div className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar médico por nome ou especialidade"
                className="pl-10 py-6 border-border focus:border-primary focus:ring-ring"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="w-full sm:w-64">
              <Label htmlFor="specialty" className="text-sm font-medium text-foreground block mb-1.5">
                <Filter className="inline-block mr-1.5 h-4 w-4 text-muted-foreground" />
                Filtrar por especialidade
              </Label>
              <Select 
                value={selectedEspecialidade} 
                onValueChange={setSelectedEspecialidade}
              >
                <SelectTrigger id="specialty" className="border-border focus:border-primary focus:ring-ring">
                  <SelectValue placeholder="Todas as especialidades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as especialidades</SelectItem>
                  {especialidades.map(esp => (
                    <SelectItem key={esp} value={esp}>{esp}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border rounded-md overflow-hidden shadow-sm">
            {isLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Carregando médicos...</p>
              </div>
            ) : filteredProfessionals.length === 0 ? (
              <div className="p-8 text-center bg-muted">
                <Stethoscope className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground mb-2">Nenhum médico encontrado.</p>
                <p className="text-sm text-muted-foreground">Tente outra busca ou remova os filtros aplicados.</p>
              </div>
            ) : (
              <div className="max-h-[300px] overflow-y-auto">
                <div className="divide-y">
                  {filteredProfessionals.map((professional) => (
                    <div
                      key={professional.id}
                      className={`p-4 hover:bg-teal-50 cursor-pointer transition-colors ${
                        selectedProfessionalId === professional.id ? 'bg-teal-100 border-l-4 border-primary dark:bg-teal-500/15' : ''
                      }`}
                      onClick={() => handleProfessionalSelect(professional.id)}
                    >
                      <div className="flex items-center">
                        <Avatar className="h-12 w-12 mr-4 border-2 border-border">
                          {/* teal-100 é fixo; no escuro as iniciais saíam em
                              menta sobre fundo quase branco. */}
                          <AvatarFallback className="bg-accent/20 text-foreground font-medium">
                            {getInitials(professional.nome)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="font-medium text-foreground">{professional.nome}</div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {professional.especialidade && (
                              <div className="flex items-center">
                                <Stethoscope className="h-3.5 w-3.5 mr-1.5 text-blue-500" />
                                {professional.especialidade}
                              </div>
                            )}
                            {professional.formacao && (
                              <div className="mt-0.5 text-muted-foreground">{professional.formacao}</div>
                            )}
                          </div>
                        </div>
                        {selectedProfessionalId === professional.id && (
                          <CheckCircle className="h-5 w-5 text-blue-600 ml-2 dark:text-blue-400" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
