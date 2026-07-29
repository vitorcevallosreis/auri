import React, { useState, useEffect } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Checkbox,
  Tabs,
  Tab,
  Spinner,
  CheckboxGroup,
  Accordion,
  AccordionItem,
  Textarea,
  Switch,
  Chip,
  RadioGroup,
  Radio,
} from "@nextui-org/react";
import { Professional } from "@/contexts/Professionals/interfaces";
import { useProfessionals } from "@/contexts/Professionals";
import { useCompany } from "@/contexts/Company";
import { useServices } from "@/contexts/Services";
import { useSpecialties } from "@/contexts/Specialties";
import { weekDays } from "../CreateProfessional/defaults";
import { Clock, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Service } from "@/contexts/Services/interfaces";
import axios from "axios";

// Extended Professional interface with additional properties
interface ExtendedProfessional extends Professional {
  specialties?: string[];
  services?: ServiceData[];
  observations?: string;
}

// Interface para o tipo de serviço no formato do fluxo de criação
interface ServiceData {
  service_id: string;
  tipo: "INDIVIDUAL" | "GRUPO" | "AMBOS";
  amount: number;
  max_pessoas?: number; // Quantidade máxima de pessoas para atendimentos em grupo
}

interface ProfessionalEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  professional: ExtendedProfessional;
  onAfterClose?: () => void;
}

export default function ProfessionalEditModal({
  isOpen,
  onClose,
  professional,
  onAfterClose
}: ProfessionalEditModalProps) {
  // Context hooks
  const { updateProfessional } = useProfessionals();
  const { companyAgreements, getCompany, getCompanyAgreements, company } = useCompany();
  const { services, getServices } = useServices();
  const { specialties, getSpecialties } = useSpecialties();
  
  // Local loading state
  const [isLoading, setIsLoading] = useState(true);

  // Form state
  const [formData, setFormData] = useState<{
    nome?: string;
    formacao?: string;
    registro?: string;
    email?: string;
    telefone?: string;
    especialidade?: string;
    quem_atende: string[];
    agreements: string[];
    specialties: string[];
    services: ServiceData[];
    scheduler: Record<string, { enabled?: boolean; opening?: string | null; closing?: string | null }>;
    observacoes?: string;
    notificame_dia?: boolean;
    notificame_horas?: boolean;
  }>({ 
    quem_atende: [], 
    agreements: [], 
    specialties: [], 
    services: [], 
    scheduler: {},
    notificame_dia: false,
    notificame_horas: false
  });
  // Usamos o isLoading do contexto da empresa
  const [selectedTab, setSelectedTab] = useState("info");

  // Day translation
  const dayNames: Record<string, string> = {
    monday: "Segunda-feira",
    tuesday: "Terça-feira",
    wednesday: "Quarta-feira",
    thursday: "Quinta-feira",
    friday: "Sexta-feira",
    saturday: "Sábado",
    sunday: "Domingo",
  };

  // Load all necessary data when the modal opens - apenas uma vez
  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      
      const loadData = async () => {
        try {
          // Carregar dados apenas se necessário
          const promises = [];
          
          if (!company) {
            promises.push(getCompany());
          }
          
          if (!companyAgreements.length) {
            promises.push(getCompanyAgreements());
          }
          
          if (!services.length) {
            promises.push(getServices());
          }
          
          if (!specialties.length) {
            promises.push(getSpecialties());
          }
          
          // Aguardar todas as promessas concluírem
          if (promises.length > 0) {
            await Promise.all(promises);
          }
        } catch (error) {
          console.error("Erro ao carregar dados:", error);
        } finally {
          setIsLoading(false);
        }
      };
      
      loadData();
    }
  }, [isOpen]); // Dependência apenas em isOpen para evitar loop

  // Initialize form data from professional
  useEffect(() => {
    if (professional && isOpen) {
       // Basic info
      const initialData = {
        nome: professional.nome || "",
        formacao: professional.formacao || "",
        registro: professional.registro || "",
        email: professional.email || "",
        telefone: professional.telefone || "",
        especialidade: professional.especialidade || "",
        
        // Age categories
        quem_atende: Array.isArray(professional.atende_cat_idade) 
          ? professional.atende_cat_idade 
          : [],
        
        // Agreements
        agreements: Array.isArray(professional.convenios_aceitos)
          ? professional.convenios_aceitos
          : [],
          
        // Specialties
        specialties: Array.isArray(professional.specialties)
          ? professional.specialties
          : [],
          
        // Services
        services: Array.isArray(professional.services) 
          ? professional.services 
          : [],
        
        // Schedule
        scheduler: professional.horarios_atendimento || {},
        
        // Observations
        observacoes: professional.observacoes || "",

        // Notification toggles
        notificame_dia: professional.notificame_dia ?? false,
        notificame_horas: professional.notificame_horas ?? false,
      };
      
      setFormData(initialData);
    }
  }, [professional, isOpen]);

  // Handle input changes
  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle age category toggle
  const handleAgeToggle = (category: string, checked: boolean) => {
    if (checked) {
      setFormData(prev => ({
        ...prev,
        quem_atende: [...prev.quem_atende, category]
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        quem_atende: prev.quem_atende.filter((item: string) => item !== category)
      }));
    }
  };

  // Handle services toggle
  const handleServiceToggle = (serviceId: string, checked: boolean) => {
    if (checked) {
      // Adiciona o serviço com valores padrão
      setFormData(prev => ({
        ...prev,
        services: [...prev.services, {
          service_id: serviceId,
          tipo: "INDIVIDUAL",
          amount: 0,
          max_pessoas: 2 // Valor padrão para quantidade de pessoas
        }]
      }));
    } else {
      // Remove o serviço
      setFormData(prev => ({
        ...prev,
        services: prev.services.filter((service) => service.service_id !== serviceId)
      }));
    }
  };

  // Handle service data change (tipo/amount)
  const handleServiceDataChange = (serviceId: string, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      services: prev.services.map((service) => {
        if (service.service_id === serviceId) {
          return {
            ...service,
            [field]: field === 'amount' ? Number(value) : value
          };
        }
        return service;
      })
    }));
  };

  // Handle agreement toggle
  const handleAgreementToggle = (agreementId: string, checked: boolean) => {
    if (checked) {
      setFormData(prev => ({
        ...prev,
        agreements: [...prev.agreements, agreementId]
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        agreements: prev.agreements.filter((id: string) => id !== agreementId)
      }));
    }
  };

  // Handle specialty toggle
  const handleSpecialtyToggle = (specialtyId: string, checked: boolean) => {
    if (checked) {
      setFormData(prev => ({
        ...prev,
        specialties: [...prev.specialties, specialtyId]
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        specialties: prev.specialties.filter((id: string) => id !== specialtyId)
      }));
    }
  };

  // Handle schedule changes
  const handleScheduleChange = (day: string, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      scheduler: {
        ...prev.scheduler,
        [day]: {
          ...(prev.scheduler[day] || {}),
          [field]: value
        }
      }
    }));

    // Clear time fields when day is disabled
    if (field === 'enabled' && !value) {
      setFormData(prev => ({
        ...prev,
        scheduler: {
          ...prev.scheduler,
          [day]: {
            ...(prev.scheduler[day] || {}),
            enabled: false,
            opening: null,
            closing: null
          }
        }
      }));
    }
  };

  // Submit form
  const handleSubmit = async () => {
    try {
      setIsLoading(true);
      
      // Validate form
      if (!formData.nome || !formData.formacao || !formData.registro || 
          !formData.email || !formData.telefone) {
        toast.error("Preencha todos os campos obrigatórios");
        setSelectedTab("info");
        setIsLoading(false);
        return;
      }

      if (!formData.quem_atende || formData.quem_atende.length === 0) {
        toast.error("Selecione pelo menos uma categoria de idade");
        setSelectedTab("attendance");
        setIsLoading(false);
        return;
      }

      if (!formData.services || formData.services.length === 0) {
        toast.error("Selecione pelo menos um serviço");
        setSelectedTab("services");
        setIsLoading(false);
        return;
      }

      // Check if at least one day is scheduled with times
      const hasSchedule = Object.values(formData.scheduler || {}).some(
        (day: any) => day.enabled && day.opening && day.closing
      );

      if (!hasSchedule) {
        toast.error("Configure pelo menos um dia com horários de atendimento");
        setSelectedTab("schedule");
        setIsLoading(false);
        return;
      }

      // Format the scheduler to match the Professional type
      const formattedScheduler = {
        monday: {
          enabled: !!formData.scheduler?.monday?.enabled,
          opening: formData.scheduler?.monday?.opening || null,
          closing: formData.scheduler?.monday?.closing || null
        },
        tuesday: {
          enabled: !!formData.scheduler?.tuesday?.enabled,
          opening: formData.scheduler?.tuesday?.opening || null,
          closing: formData.scheduler?.tuesday?.closing || null
        },
        wednesday: {
          enabled: !!formData.scheduler?.wednesday?.enabled,
          opening: formData.scheduler?.wednesday?.opening || null,
          closing: formData.scheduler?.wednesday?.closing || null
        },
        thursday: {
          enabled: !!formData.scheduler?.thursday?.enabled,
          opening: formData.scheduler?.thursday?.opening || null,
          closing: formData.scheduler?.thursday?.closing || null
        },
        friday: {
          enabled: !!formData.scheduler?.friday?.enabled,
          opening: formData.scheduler?.friday?.opening || null,
          closing: formData.scheduler?.friday?.closing || null
        },
        saturday: {
          enabled: !!formData.scheduler?.saturday?.enabled,
          opening: formData.scheduler?.saturday?.opening || null,
          closing: formData.scheduler?.saturday?.closing || null
        },
        sunday: {
          enabled: !!formData.scheduler?.sunday?.enabled,
          opening: formData.scheduler?.sunday?.opening || null,
          closing: formData.scheduler?.sunday?.closing || null
        }
      };

      // Prepare data for update - incluindo os campos necessários para o webhook
      const updatedProfessional = {
        id: professional.id, // ID do profissional para identificação no webhook
        company_id: company?.id,
        nome: formData.nome || '',
        formacao: formData.formacao || '',
        registro: formData.registro || '',
        email: formData.email || '',
        telefone: formData.telefone || '',
        especialidade: formData.especialidade || '', // Campo de especialidade do primeiro passo
        quem_atende: formData.quem_atende, // Usando a mesma nomenclatura do cadastro
        agreements: formData.agreements || [],
        horarios_atendimento: formattedScheduler,
        observacoes: formData.observacoes || '',
        services: formData.services,
        specialties: formData.specialties,
        notificame_dia: formData.notificame_dia ?? false,
        notificame_horas: formData.notificame_horas ?? false
      };
      
      console.log("Enviando dados para o webhook de edição:", updatedProfessional);
      
      // Enviar dados para o webhook de edição
      const response = await axios.post(
        "https://webhooks.sejanexa.com.br/webhook/editar-profissional",
        {
          body: updatedProfessional,
        }
      );
      
      console.log("Resposta do webhook:", response.data);
      
      if (response.data.status !== "Success" && response.data.status !== "Sucess") {
        console.error("Erro na resposta do webhook:", response.data);
        toast.error("Erro ao atualizar profissional, tente novamente mais tarde.");
        setIsLoading(false);
        return;
      }
      
      // Atualizar estado local após sucesso no webhook
      await updateProfessional(professional.id, updatedProfessional);
      
      toast.success("Profissional atualizado com sucesso");
      setIsLoading(false);
      onClose();
    } catch (error) {
      console.error("Erro ao atualizar profissional:", error);
      toast.error("Erro ao atualizar profissional");
      setIsLoading(false);
    }
  };

  // Handler robusto para resetar o estado de edição ao fechar o modal
  const handleModalClose = () => {
    onClose();
    if (onAfterClose) onAfterClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleModalClose} size="3xl" scrollBehavior="inside" data-edit-modal-open={isOpen ? "true" : undefined}>
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              <h2>Editar Profissional</h2>
              <p className="text-sm text-muted-foreground font-normal">
                {professional.nome} - {professional.formacao}
              </p>
              {isLoading && (
                <div className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  Carregando dados da empresa...
                </div>
              )}
            </ModalHeader>
            <ModalBody>
              <div style={{ overflowX: 'auto', whiteSpace: 'nowrap' }}>
                <Tabs
                  selectedKey={selectedTab}
                  onSelectionChange={setSelectedTab as any}
                  aria-label="Edição do Profissional"
                  classNames={{ tabList: 'min-w-[700px]' }}
                >
                <Tab key="info" title="Informações Básicas">
                  <div className="space-y-4 py-2">
                    <Input
                      label="Nome"
                      placeholder="Nome completo"
                      value={formData.nome || ""}
                      onChange={(e) => handleInputChange("nome", e.target.value)}
                      isRequired
                    />
                    <Input
                      label="Formação"
                      placeholder="Ex: Psicólogo"
                      value={formData.formacao || ""}
                      onChange={(e) => handleInputChange("formacao", e.target.value)}
                      isRequired
                    />
                    <Input
                      label="Registro Profissional"
                      placeholder="Ex: CRP 12345"
                      value={formData.registro || ""}
                      onChange={(e) => handleInputChange("registro", e.target.value)}
                      isRequired
                    />
                    <Input
                      label="Especialidade"
                      placeholder="Ex: Psicanálise"
                      value={formData.especialidade || ""}
                      onChange={(e) => handleInputChange("especialidade", e.target.value)}
                    />
                    <Input
                      label="Email"
                      placeholder="email@exemplo.com"
                      value={formData.email || ""}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      isRequired
                    />
                    <Input
                      label="Telefone"
                      placeholder="(00) 00000-0000"
                      value={formData.telefone || ""}
                      onChange={(e) => handleInputChange("telefone", e.target.value)}
                      isRequired
                    />
                  </div>
                </Tab>

                {/* Nova seção de notificações */}
                <Tab key="notifications" title="Notificações">
                  <div className="space-y-4 py-4">
                    <h3 className="text-md font-medium">Configurações de Notificação</h3>
                    <div className="flex flex-col gap-4">
                      <Switch
                        isSelected={!!formData.notificame_horas}
                        onValueChange={(checked) => handleInputChange("notificame_horas", checked)}
                      >
                        Notificar após cada consulta agendada
                      </Switch>
                      <Switch
                        isSelected={!!formData.notificame_dia}
                        onValueChange={(checked) => handleInputChange("notificame_dia", checked)}
                      >
                        Notificar diariamente sobre a agenda
                      </Switch>
                    </div>
                  </div>
                </Tab>
                
                <Tab key="attendance" title="Categorias de Atendimento">
                  <div className="space-y-6 py-4">
                    <div>
                      <h3 className="text-md font-medium mb-2">Quem atende?</h3>
                      <div className="flex flex-wrap gap-4">
                        <Checkbox
                          isSelected={formData.quem_atende?.includes("ADULTO")}
                          onValueChange={(checked) => handleAgeToggle("ADULTO", checked)}
                        >
                          Adulto
                        </Checkbox>
                        <Checkbox
                          isSelected={formData.quem_atende?.includes("ADOLESCENTE")}
                          onValueChange={(checked) => handleAgeToggle("ADOLESCENTE", checked)}
                        >
                          Adolescente
                        </Checkbox>
                        <Checkbox
                          isSelected={formData.quem_atende?.includes("CRIANÇA")}
                          onValueChange={(checked) => handleAgeToggle("CRIANÇA", checked)}
                        >
                          Criança
                        </Checkbox>
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="text-md font-medium mb-2">Convênios Aceitos</h3>
                      {companyAgreements.length === 0 ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                          <Spinner size="sm" />
                          <span>Carregando convênios...</span>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-4 max-h-[200px] overflow-y-auto p-1">
                          {companyAgreements.map((agreement) => (
                            <Checkbox
                              key={agreement.id}
                              isSelected={formData.agreements?.includes(agreement.id)}
                              onValueChange={(checked) => handleAgreementToggle(agreement.id, checked)}
                            >
                              {agreement.name}
                            </Checkbox>
                          ))}
                          {companyAgreements.length > 0 && (
                            <div className="w-full mt-2 text-xs text-muted-foreground">
                              {formData.agreements?.length || 0} convênio(s) selecionado(s)
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </Tab>
                
                <Tab key="specialties" title="Especialidades">
                  <div className="space-y-4 py-4">
                    <h3 className="text-md font-medium">Especialidades</h3>
                    {specialties.length === 0 ? (
                      <div className="flex flex-col items-center justify-center p-4">
                        <Spinner size="sm" color="primary" className="mb-2" />
                        <p className="text-sm text-muted-foreground">Carregando especialidades...</p>
                      </div>
                    ) : (
                      <>
                        <Input
                          type="search"
                          placeholder="Buscar especialidades"
                          className="mb-3"
                          startContent={
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="11" cy="11" r="8"/>
                              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                            </svg>
                          }
                          onChange={(e) => {
                            // Implementar busca se necessário
                          }}
                        />
                        <div className="flex flex-wrap gap-4 max-h-[300px] overflow-y-auto p-1">
                          {specialties.map((specialty) => (
                            <Checkbox
                              key={specialty.id}
                              isSelected={formData.specialties?.includes(specialty.id)}
                              onValueChange={(checked) => handleSpecialtyToggle(specialty.id, checked)}
                            >
                              {specialty.name}
                            </Checkbox>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </Tab>
                
                <Tab key="services" title="Serviços">
                  <div className="space-y-4 py-4">
                    <h3 className="text-md font-medium">Serviços Oferecidos</h3>
                    {services.length === 0 ? (
                      <div className="flex flex-col items-center justify-center p-4">
                        <Spinner size="sm" color="primary" className="mb-2" />
                        <p className="text-sm text-muted-foreground">Carregando serviços...</p>
                      </div>
                    ) : (
                      <>
                        <Input
                          type="search"
                          placeholder="Buscar serviços"
                          className="mb-3"
                          startContent={
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="11" cy="11" r="8"/>
                              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                            </svg>
                          }
                          onChange={(e) => {
                            // Implementar busca se necessário
                          }}
                        />
                        <div className="space-y-4 max-h-[350px] overflow-y-auto p-1">
                          {services.map((service) => (
                            <div key={service.id} className="border rounded-lg p-3">
                              <Checkbox
                                isSelected={formData.services?.some(s => s.service_id === service.id)}
                                onValueChange={(checked) => handleServiceToggle(service.id, checked)}
                              >
                                <span className="font-medium">{service.name}</span>
                              </Checkbox>
                              
                              {formData.services?.some(s => s.service_id === service.id) && (
                                <div className="mt-3 pl-7 space-y-3">
                                  <div className="space-y-3">
                                    <RadioGroup
                                      label="Tipo de atendimento"
                                      orientation="horizontal"
                                      value={formData.services.find(s => s.service_id === service.id)?.tipo || "INDIVIDUAL"}
                                      onValueChange={(value) => 
                                        handleServiceDataChange(service.id, "tipo", value)
                                      }
                                    >
                                      <Radio value="INDIVIDUAL">Individual</Radio>
                                      <Radio value="GRUPO">Grupo</Radio>
                                      <Radio value="AMBOS">Ambos</Radio>
                                    </RadioGroup>
                                  </div>
                                  <Input
                                    type="number"
                                    label="Valor (R$)"
                                    placeholder="0,00"
                                    min={0}
                                    value={formData.services.find(s => s.service_id === service.id)?.amount.toString() || "0"}
                                    onChange={(e) => 
                                      handleServiceDataChange(
                                        service.id, 
                                        "amount", 
                                        e.target.value ? parseFloat(e.target.value) : 0
                                      )
                                    }
                                  />
                                  
                                  {/* Campo para quantidade de pessoas quando o tipo for GRUPO ou AMBOS */}
                                  {(formData.services.find(s => s.service_id === service.id)?.tipo === "GRUPO" ||
                                    formData.services.find(s => s.service_id === service.id)?.tipo === "AMBOS") && (
                                    <Input
                                      type="number"
                                      label="Quantidade máxima de pessoas"
                                      placeholder="0"
                                      min={2}
                                      value={formData.services.find(s => s.service_id === service.id)?.max_pessoas?.toString() || "0"}
                                      onChange={(e) => 
                                        handleServiceDataChange(
                                          service.id, 
                                          "max_pessoas", 
                                          e.target.value ? parseInt(e.target.value) : 0
                                        )
                                      }
                                    />
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </Tab>
                
                <Tab key="schedule" title="Agenda">
                  <div className="space-y-6 py-4">
                    <h3 className="text-md font-medium">Horários de Atendimento</h3>
                    <Accordion>
                      {weekDays.map((day) => (
                        <AccordionItem 
                          key={day.id} 
                          title={dayNames[day.id]}
                          startContent={
                            <Checkbox
                              isSelected={!!formData.scheduler?.[day.id]?.enabled}
                              onValueChange={(checked) => 
                                handleScheduleChange(day.id, "enabled", checked)
                              }
                            />
                          }
                        >
                          {formData.scheduler?.[day.id]?.enabled && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                              <div className="space-y-1">
                                <label className="text-sm font-medium">Abertura</label>
                                <div className="flex items-center space-x-2">
                                  <Clock size={16} className="text-muted-foreground" />
                                  <Input
                                    type="time"
                                    value={formData.scheduler?.[day.id]?.opening || ""}
                                    onChange={(e) => 
                                      handleScheduleChange(day.id, "opening", e.target.value)
                                    }
                                  />
                                </div>
                              </div>
                              <div className="space-y-1">
                                <label className="text-sm font-medium">Fechamento</label>
                                <div className="flex items-center space-x-2">
                                  <Clock size={16} className="text-muted-foreground" />
                                  <Input
                                    type="time"
                                    value={formData.scheduler?.[day.id]?.closing || ""}
                                    onChange={(e) => 
                                      handleScheduleChange(day.id, "closing", e.target.value)
                                    }
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </div>
                </Tab>
                
                <Tab key="observations" title="Observações">
                  <div className="space-y-4 py-4">
                    <Textarea
                      label="Observações sobre o atendimento"
                      placeholder="Informações adicionais sobre o atendimento deste profissional..."
                      value={formData.observacoes || ""}
                      onChange={(e) => handleInputChange("observacoes", e.target.value)}
                      minRows={5}
                    />
                  </div>
                </Tab>
              </Tabs>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={() => {
                onClose();
                if (onAfterClose) onAfterClose();
              }}>
                Cancelar
              </Button>
              <Button 
                color="primary" 
                onPress={handleSubmit}
                isLoading={isLoading}
              >
                {isLoading ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
