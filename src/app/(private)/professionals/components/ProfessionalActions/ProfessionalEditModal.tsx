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
import DadosPrescricao, {
  cpfValido,
  type DadosPrescricaoValores,
} from "../DadosPrescricao";

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
  const { updateProfessional, loadProfessionalCatalog, replaceProfessionalCatalog } =
    useProfessionals();
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
    cpf?: string;
    data_nascimento?: string;
    conselho_sigla?: string;
    conselho_numero?: string;
    conselho_uf?: string;
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

  // A AGENDA DE VERDADE — a que o agente lê em myia_professional_availability.
  //
  // Vive fora de `formData.scheduler` porque as duas coisas não têm a mesma
  // forma. `scheduler` (e a coluna `horarios_atendimento`) guarda UM par
  // abertura/fechamento por dia, que é o que o formulário de cadastro sabe
  // pedir. O banco guarda uma LISTA de janelas por dia, e é por isso que o
  // intervalo de almoço existe: 08:00–12:00 e 13:00–18:00 são duas linhas.
  //
  // Colapsar as duas em uma só transformaria essa agenda em 08:00–18:00 e o
  // agente passaria a oferecer consulta ao meio-dia — sem erro em lugar nenhum.
  const [agenda, setAgenda] = useState<Record<string, Array<{ opening: string; closing: string }>>>({});
  const [agendaCarregada, setAgendaCarregada] = useState(false);

  const janelasDe = (dia: string) => agenda[dia] ?? [];

  const mudarJanela = (dia: string, i: number, campo: "opening" | "closing", valor: string) => {
    setAgenda((prev) => {
      const lista = [...(prev[dia] ?? [])];
      lista[i] = { ...lista[i], [campo]: valor };
      return { ...prev, [dia]: lista };
    });
  };

  const adicionarJanela = (dia: string) => {
    setAgenda((prev) => {
      const lista = prev[dia] ?? [];
      // A segunda janela do dia nasce depois do almoço, que é o caso real de
      // quem clica em "adicionar". Um par vazio faria o usuário digitar quatro
      // campos para o arranjo mais comum que existe.
      const sugestao = lista.length === 0
        ? { opening: "08:00", closing: "12:00" }
        : { opening: "13:00", closing: "18:00" };
      return { ...prev, [dia]: [...lista, sugestao] };
    });
  };

  const removerJanela = (dia: string, i: number) => {
    setAgenda((prev) => ({ ...prev, [dia]: (prev[dia] ?? []).filter((_, j) => j !== i) }));
  };

  const diaAtivo = (dia: string) => janelasDe(dia).length > 0;

  const alternarDia = (dia: string, ligado: boolean) => {
    if (ligado) adicionarJanela(dia);
    else setAgenda((prev) => ({ ...prev, [dia]: [] }));
  };

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

        // Prescrição digital (Memed). Vazio é o normal: o backfill de 0026 só
        // conseguiu preencher o conselho a partir do texto livre de `registro`.
        cpf: professional.cpf || "",
        data_nascimento: professional.data_nascimento || "",
        conselho_sigla: professional.conselho_sigla || "",
        conselho_numero: professional.conselho_numero || "",
        conselho_uf: professional.conselho_uf || "",

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

  // Serviços e agenda vêm do BANCO, não do objeto `professional`.
  //
  // `professional.services` e `horarios_atendimento` são campos de UI/exibição
  // que a listagem monta; nenhum dos dois é a fonte que o agente consulta. Até
  // aqui este modal simplesmente não carregava o catálogo, e por isso não podia
  // gravá-lo: regravar sem ter carregado apagaria a agenda feita no cadastro.
  // Carregar é o que destrava editar.
  useEffect(() => {
    if (!isOpen || !professional?.id) return;

    let cancelado = false;
    setAgendaCarregada(false);

    loadProfessionalCatalog(professional.id as any)
      .then((catalogo) => {
        if (cancelado) return;
        setAgenda(catalogo.agenda);
        // Só sobrescreve os serviços se o banco tiver algo a dizer. Um
        // profissional antigo, cadastrado antes de a tela gravar o catálogo,
        // não pode ter a seleção zerada só por abrir o modal.
        if (catalogo.services.length > 0) {
          setFormData((prev) => ({ ...prev, services: catalogo.services as ServiceData[] }));
        }
        setAgendaCarregada(true);
      })
      .catch((erro) => {
        console.error("Erro ao carregar a agenda do profissional:", erro);
        toast.error("Não consegui carregar a agenda deste profissional.");
        // Fica FALSO de propósito: salvar sem ter carregado apagaria a agenda
        // existente, e é exatamente o que o `handleSubmit` checa antes de
        // tocar em myia_professional_availability.
        setAgendaCarregada(false);
      });

    return () => {
      cancelado = true;
    };
  }, [isOpen, professional?.id]);

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

  // Handle agreement toggle. Trabalha com o NOME do convênio, não com o id:
  // é o nome que está em `convenios_aceitos` (de onde o formulário carrega) e
  // é o nome que volta para lá ao salvar. Casar por id quebrava o ida-e-volta —
  // nada vinha marcado e salvar limpava os convênios do profissional.
  const handleAgreementToggle = (agreementName: string, checked: boolean) => {
    if (checked) {
      setFormData(prev => ({
        ...prev,
        agreements: [...prev.agreements, agreementName]
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        agreements: prev.agreements.filter((name: string) => name !== agreementName)
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

  // `handleScheduleChange` foi removido junto com o editor de uma janela por
  // dia. Quem edita agenda agora é `agenda`/`mudarJanela` acima, que fala com
  // myia_professional_availability — a tabela que o agente realmente lê.

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

      // Os campos da Memed são opcionais, mas o que for preenchido tem de
      // caber nos CHECKs de 0026. Sem esta checagem o erro chegaria como uma
      // violação de constraint crua vinda do PostgREST, sem dizer qual campo.
      if (formData.cpf && !cpfValido(formData.cpf)) {
        toast.error("CPF inválido. Deixe em branco se ainda não tiver o dado.");
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

      // A agenda é validada contra `agenda` (o que o banco guarda), não contra
      // `formData.scheduler` (o JSON de exibição). Eram fontes diferentes, e a
      // antiga aprovava um profissional cuja agenda real estava vazia.
      const janelas = Object.entries(agenda).flatMap(([dia, lista]) =>
        (lista ?? []).map((j) => ({ dia, ...j }))
      );

      if (janelas.length === 0) {
        toast.error("Configure pelo menos um dia com horários de atendimento");
        setSelectedTab("schedule");
        setIsLoading(false);
        return;
      }

      const incompleta = janelas.find((j) => !j.opening || !j.closing);
      if (incompleta) {
        toast.error(`Preencha os dois horários de ${dayNames[incompleta.dia]}`);
        setSelectedTab("schedule");
        setIsLoading(false);
        return;
      }

      const invertida = janelas.find((j) => j.closing <= j.opening);
      if (invertida) {
        toast.error(
          `Em ${dayNames[invertida.dia]}, o fim (${invertida.closing}) precisa ser depois do início (${invertida.opening}).`
        );
        setSelectedTab("schedule");
        setIsLoading(false);
        return;
      }

      // Duas janelas que se cruzam no mesmo dia geram linhas concorrentes e o
      // agente ofereceria o mesmo horário duas vezes. Barrar aqui é mais barato
      // que explicar depois.
      for (const dia of Object.keys(agenda)) {
        const lista = [...(agenda[dia] ?? [])].sort((a, b) => a.opening.localeCompare(b.opening));
        for (let i = 1; i < lista.length; i++) {
          if (lista[i].opening < lista[i - 1].closing) {
            toast.error(`As faixas de ${dayNames[dia]} se sobrepõem.`);
            setSelectedTab("schedule");
            setIsLoading(false);
            return;
          }
        }
      }

      if (!agendaCarregada) {
        // Sem ter carregado a agenda atual, "substituir" apagaria o que existe.
        toast.error("A agenda deste profissional não carregou. Feche e abra o modal de novo.");
        setIsLoading(false);
        return;
      }

      // `horarios_atendimento` é a coluna de EXIBIÇÃO do painel; quem manda
      // para o agente é myia_professional_availability. Deriva-se da agenda
      // real para as duas não divergirem — mas ela só cabe uma janela por dia,
      // então guarda a PRIMEIRA e o dia fica marcado como ativo. É perda
      // conhecida e só afeta o texto mostrado na listagem.
      const formattedScheduler = Object.fromEntries(
        weekDays.map((d) => {
          const lista = [...(agenda[d.id] ?? [])].sort((a, b) =>
            a.opening.localeCompare(b.opening)
          );
          return [
            d.id,
            {
              enabled: lista.length > 0,
              opening: lista[0]?.opening ?? null,
              closing: lista[lista.length - 1]?.closing ?? null,
            },
          ];
        })
      );

      // Só colunas de `myia_professionals_medical`. Serviços e agenda vão numa
      // segunda requisição, logo abaixo — o PostgREST não dá transação entre as
      // duas, e a ordem escolhida (profissional primeiro) é a que falha melhor:
      // se a segunda quebrar, o cadastro está salvo e a agenda continua a
      // antiga, em vez de o profissional ficar sem agenda nenhuma.
      const updatedProfessional = {
        nome: formData.nome || '',
        formacao: formData.formacao || '',
        registro: formData.registro || '',
        email: formData.email || '',
        telefone: formData.telefone || '',
        especialidade: formData.especialidade || '',
        atende_cat_idade: formData.quem_atende,
        // Já são nomes — ver `handleAgreementToggle`.
        convenios_aceitos: formData.agreements || [],
        horarios_atendimento: formattedScheduler,
        observacoes: formData.observacoes || '',
        notificame_dia: formData.notificame_dia ?? false,
        notificame_horas: formData.notificame_horas ?? false,
        // NULL, não string vazia: `cpf` e `conselho_uf` têm CHECK de formato e
        // `data_nascimento` é `date` — os três recusariam "".
        cpf: formData.cpf || null,
        data_nascimento: formData.data_nascimento || null,
        conselho_sigla: formData.conselho_sigla || null,
        conselho_numero: formData.conselho_numero || null,
        conselho_uf: formData.conselho_uf || null,
      };

      await updateProfessional(professional.id, updatedProfessional);

      // A agenda que o agente lê. `replace`, não `upsert`: o dia que o usuário
      // desmarcou precisa SUMIR do banco — com upsert a tela dizia "salvo" e o
      // agente seguia oferecendo o horário removido.
      await replaceProfessionalCatalog(professional.id as any, {
        services: formData.services ?? [],
        agenda,
      });

      toast.success("Profissional atualizado com sucesso");
      setIsLoading(false);
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      console.error("Erro ao atualizar profissional:", error);
      toast.error(`Erro ao atualizar profissional: ${message}`);
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
                <div className="text-xs text-amber-600 mt-1 flex items-center gap-1 dark:text-amber-400">
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

                    <div className="pt-2 border-t">
                      <DadosPrescricao
                        valores={formData as DadosPrescricaoValores}
                        onChange={handleInputChange}
                      />
                    </div>
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
                              isSelected={formData.agreements?.includes(agreement.name)}
                              onValueChange={(checked) => handleAgreementToggle(agreement.name, checked)}
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
                  <div className="space-y-4 py-4">
                    <div>
                      <h3 className="text-md font-medium">Horários de Atendimento</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        É esta agenda que a IA consulta para oferecer horário ao paciente.
                        Use duas faixas no mesmo dia para o intervalo de almoço.
                      </p>
                    </div>

                    {!agendaCarregada && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Spinner size="sm" />
                        Carregando a agenda atual…
                      </div>
                    )}

                    <Accordion>
                      {weekDays.map((day) => (
                        <AccordionItem
                          key={day.id}
                          title={dayNames[day.id]}
                          subtitle={
                            diaAtivo(day.id)
                              ? janelasDe(day.id)
                                  .map((j) => `${j.opening || "--:--"}–${j.closing || "--:--"}`)
                                  .join("  ·  ")
                              : "Não atende"
                          }
                          startContent={
                            <Checkbox
                              isSelected={diaAtivo(day.id)}
                              isDisabled={!agendaCarregada}
                              onValueChange={(marcado) => alternarDia(day.id, marcado)}
                            />
                          }
                        >
                          {diaAtivo(day.id) && (
                            <div className="space-y-3 mt-2">
                              {janelasDe(day.id).map((janela, i) => (
                                <div key={i} className="flex items-end gap-3">
                                  <div className="space-y-1 flex-1">
                                    <label className="text-sm font-medium">Início</label>
                                    <div className="flex items-center space-x-2">
                                      <Clock size={16} className="text-muted-foreground" />
                                      <Input
                                        type="time"
                                        value={janela.opening || ""}
                                        onChange={(e) =>
                                          mudarJanela(day.id, i, "opening", e.target.value)
                                        }
                                      />
                                    </div>
                                  </div>
                                  <div className="space-y-1 flex-1">
                                    <label className="text-sm font-medium">Fim</label>
                                    <div className="flex items-center space-x-2">
                                      <Clock size={16} className="text-muted-foreground" />
                                      <Input
                                        type="time"
                                        value={janela.closing || ""}
                                        onChange={(e) =>
                                          mudarJanela(day.id, i, "closing", e.target.value)
                                        }
                                      />
                                    </div>
                                  </div>
                                  <Button
                                    isIconOnly
                                    variant="light"
                                    aria-label={`Remover faixa de ${dayNames[day.id]}`}
                                    onPress={() => removerJanela(day.id, i)}
                                  >
                                    <Minus size={16} />
                                  </Button>
                                </div>
                              ))}

                              <Button
                                size="sm"
                                variant="flat"
                                startContent={<Plus size={16} />}
                                onPress={() => adicionarJanela(day.id)}
                              >
                                Adicionar faixa
                              </Button>
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
