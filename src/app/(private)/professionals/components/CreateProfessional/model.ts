"use client"

import { Dispatch, SetStateAction, useEffect, useState } from "react"
import {
  formSchema,
  FormData,
  stepOneSchema,
  stepTwoSchema,
  stepThreeSchema,
} from "./schemas"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  UseFormHandleSubmit,
  UseFormRegister,
  FieldErrors,
  useForm,
  UseFormWatch,
  UseFormSetValue,
} from "react-hook-form"
import { formSteps } from "./defaults"
import { useCompany } from "@/contexts/Company"
import { CompanyAgreement } from "@/contexts/Company/interfaces"
import { useServices } from "@/contexts/Services"
import { Service } from "@/contexts/Services/interfaces"
import { toast } from "sonner"
import { useSpecialties } from "@/contexts/Specialties"
import { Specialty } from "@/contexts/Specialties/interfaces"
import { useProfessionals } from "@/contexts/Professionals"
import { Professional } from "@/contexts/Professionals/interfaces"
import { UUID } from "crypto"

export type FormStep =
  | "select"
  | "info"
  | "ageCategories"
  | "agreements"
  | "specialties"
  | "services"
  | "schedule"
  | "observations"

export enum EnumFormStep {
  SELECT = "select",
  INFO = "info",
  AGE_CATEGORIES = "ageCategories",
  AGREEMENTS = "agreements",
  SPECIALTIES = "specialties",
  SERVICES = "services",
  SCHEDULE = "schedule",
  OBSERVATIONS = "observations",
}

export type AgeCategories = "ADULTO" | "ADOLESCENTE" | "CRIANÇA"
export enum EnumAgeCategories {
  ADULT = "ADULTO",
  TEEN = "ADOLESCENTE",
  CHILD = "CRIANÇA",
}

export interface ICreateProfessionalModel {
  setShowForm: Dispatch<SetStateAction<boolean>>
  current_step: FormStep
  currentStepIndex: number
  currentProgress: number
  nextStep: () => void

  handleSubmit: UseFormHandleSubmit<FormData>
  onSubmit: (data: FormData) => Promise<void>
  register: UseFormRegister<FormData>
  errors: FieldErrors<FormData>
  watch: UseFormWatch<FormData>
  setValue: UseFormSetValue<FormData>
  handleToggleageCategories: (
    fieldValue: AgeCategories,
    isSelected: boolean
  ) => void
  companyAgreements: CompanyAgreement[]
  handleToggleAgreements: (isSelected: boolean, agreement_id: string) => void
  handleToggleSpecialties: (isSelected: boolean, specialty_id: string) => void
  services: Service[]
  filteredServices: Service[]
  searchTerm: string
  setSearchTerm: Dispatch<SetStateAction<string>>
  goBackStep: () => void
  is_loading: boolean
  specialties: Specialty[]
  existingProfessionals: Professional[]
  selectProfessional: (professional: Professional) => void
  isCreatingNew: boolean
  setIsCreatingNew: Dispatch<SetStateAction<boolean>>
  professionalSearchTerm: string
  setProfessionalSearchTerm: Dispatch<SetStateAction<string>>
}

const useCreateProfessionalModel = (
  setShowForm: Dispatch<SetStateAction<boolean>>
): ICreateProfessionalModel => {
  const { getSpecialties, specialties } = useSpecialties()
  const { company, companyAgreements, getCompany } = useCompany()
  const { services, getServices } = useServices()
  const {
    professionals,
    fetchProfessionals,
    createProfessional,
    updateProfessional,
    setProfessionalCatalog,
  } = useProfessionals()

  const [current_step, set_current_step] = useState<FormStep>(EnumFormStep.SELECT)
  const currentStepIndex = formSteps.findIndex(
    (step) => step.key === current_step
  )
  const currentProgress = ((currentStepIndex + 1) / formSteps.length) * 100
  const [searchTerm, setSearchTerm] = useState("")
  const [professionalSearchTerm, setProfessionalSearchTerm] = useState("")
  const [is_loading, set_is_loading] = useState(false)
  const [isCreatingNew, setIsCreatingNew] = useState(true)
  const [existingProfessionals, setExistingProfessionals] = useState<Professional[]>([])
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<UUID | null>(null)

  // Carregar dados da empresa quando o componente for montado
  useEffect(() => {
    if (!company || !company.id) {
      getCompany()
      getServices()
    }
  }, [company])

  // Carregar profissionais quando a empresa estiver disponível
  useEffect(() => {
    if (company && company.id) {
      fetchProfessionals(company.id as `${string}-${string}-${string}-${string}-${string}`)
    }
  }, [company])

  // Atualizar a lista de profissionais quando o contexto for atualizado
  useEffect(() => {
    if (professionals) {
      setExistingProfessionals(professionals)
    }
  }, [professionals])

  useEffect(() => {
    if (current_step !== EnumFormStep.SERVICES) return

    getServices()
  }, [company, current_step])

  useEffect(() => {
    if (current_step !== EnumFormStep.SPECIALTIES) return

    getSpecialties()
  }, [company, current_step])

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    setValue,
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    defaultValues: {
      nome: "",
      formacao: "",
      registro: "",
      email: "",
      telefone: "",
      quem_atende: [],
      scheduler: {
        friday: {
          closing: "",
          enabled: false,
          opening: "",
        },
        monday: {
          closing: "",
          enabled: false,
          opening: "",
        },
        sunday: {
          closing: "",
          enabled: false,
          opening: "",
        },
        tuesday: {
          closing: "",
          enabled: false,
          opening: "",
        },
        saturday: {
          closing: "",
          enabled: false,
          opening: "",
        },
        thursday: {
          closing: "",
          enabled: false,
          opening: "",
        },
        wednesday: {
          closing: "",
          enabled: false,
          opening: "",
        },
      },
      observacoes: "",
    },
  })

  useEffect(() => {
    if (!company.id) return

    setValue("company_id", company?.id)
  }, [company])

  const onSubmit = async (data: FormData): Promise<void> => {
    if (!company?.id) {
      toast.error("Empresa não carregada. Recarregue a página e tente de novo.")
      return
    }

    set_is_loading(true)

    try {
      data.company_id = company.id

      // O formulário guarda IDs; as colunas do banco guardam NOMES. Estas duas
      // colunas são lidas por `listar_profissionais` e vão direto para o
      // paciente pela boca do agente — gravar UUID aqui faria o agente dizer
      // "atendo o convênio 3f2b91a4-…".
      const agreementNames = (data.agreements ?? [])
        .map((id) => companyAgreements.find((a) => a.id === id)?.name)
        .filter((name): name is string => Boolean(name))

      const specialtyNames = (data.specialties ?? [])
        .map((id) => specialties.find((s) => s.id === id)?.name)
        .filter((name): name is string => Boolean(name))

      const campos = {
        nome: data.nome,
        formacao: data.formacao,
        registro: data.registro,
        email: data.email,
        telefone: data.telefone,
        // A tabela tem UMA coluna de especialidade (texto) e o formulário
        // deixa marcar várias. `listar_profissionais` filtra com ilike, então
        // juntar por vírgula mantém a busca por qualquer uma delas.
        especialidade: specialtyNames.join(", ") || null,
        search_tags: specialtyNames,
        atende_cat_idade: data.quem_atende,
        convenios_aceitos: agreementNames,
        horarios_atendimento: data.scheduler,
        observacoes: data.observacoes || null,
      }

      const catalogo = {
        services: data.services ?? [],
        scheduler: data.scheduler,
      }

      // O passo 1 do formulário deixa escolher entre criar um profissional novo
      // e configurar um já cadastrado. No segundo caso o que se quer é
      // ATUALIZAR aquele profissional (e somar serviços/agenda), não duplicá-lo.
      if (!isCreatingNew && selectedProfessionalId) {
        await updateProfessional(selectedProfessionalId, campos)
        await setProfessionalCatalog(selectedProfessionalId, catalogo)
        toast.success("Profissional atualizado com sucesso!")
      } else {
        const created = await createProfessional(
          { company_id: company.id, ...campos },
          catalogo
        )

        if (!created) {
          toast.error("Não foi possível criar o profissional.")
          return
        }

        toast.success("Profissional criado com sucesso!")
      }

      setShowForm(false)

      // Recarregar a lista de profissionais após a criação bem-sucedida
      await fetchProfessionals(company.id as `${string}-${string}-${string}-${string}-${string}`)

      reset()
      setValue("company_id", company.id)
      set_current_step(EnumFormStep.SELECT)
      setSearchTerm("")
      setProfessionalSearchTerm("")
      setIsCreatingNew(true)
      setSelectedProfessionalId(null)
      getCompany()
      getServices()
    } catch (error) {
      // O caminho antigo engolia o erro num console.log e a tela não mudava —
      // clicar em salvar não fazia absolutamente nada visível.
      const message =
        error instanceof Error ? error.message : "Erro desconhecido"
      console.error("Erro ao salvar profissional:", error)
      toast.error(`Erro ao salvar profissional: ${message}`)
    } finally {
      set_is_loading(false)
    }
  }

  const selectProfessional = (professional: Professional) => {
    // Guardado para o submit saber que é ATUALIZAÇÃO. Sem isso, o passo
    // "Selecionar profissional existente" gravaria uma segunda linha com o
    // mesmo nome.
    setSelectedProfessionalId(professional.id)

    // Preencher APENAS os campos básicos do formulário (passo 1) com os dados do profissional selecionado
    setValue("nome", professional.nome || "")
    setValue("formacao", professional.formacao || "")
    setValue("registro", professional.registro || "")
    setValue("email", professional.email || "")
    setValue("telefone", professional.telefone || "")
    
    // Inicializar outros campos com valores padrão para nova criação
    // Desta forma, garantimos que os campos estejam vazios para preenchimento nos próximos passos
    setValue("agreements", [])
    setValue("specialties", [])
    setValue("services", [])
    setValue("observacoes", "")
    
    // As categorias de atendimento fazem parte do passo 2, mas podemos manter os valores padrão
    setValue("quem_atende", ["ADULTO"])
    
    // Avançar para a próxima etapa
    setIsCreatingNew(false);
    nextStep();
  };

  const nextStep = async () => {
    if (current_step === EnumFormStep.SELECT) {
      set_current_step(EnumFormStep.INFO);
      return;
    }
    if (current_step === EnumFormStep.INFO) {
      const result = stepOneSchema.safeParse(watch())
      if (!result.success) return

      set_current_step(EnumFormStep.AGE_CATEGORIES)
    }
    if (current_step === EnumFormStep.AGE_CATEGORIES) {
      const result = stepTwoSchema.safeParse(watch())
      if (!result.success) return

      set_current_step(EnumFormStep.AGREEMENTS)
    }

    if (current_step === EnumFormStep.AGREEMENTS) {
      const result = stepThreeSchema.safeParse(watch())
      if (!result.success) return

      set_current_step(EnumFormStep.SPECIALTIES)
    }

    if (current_step === EnumFormStep.SPECIALTIES) {
      set_current_step(EnumFormStep.SERVICES)
    }

    if (current_step === EnumFormStep.SERVICES) {
      // Verificar se pelo menos um serviço foi selecionado
      const services = watch("services") || []
      if (services.length === 0) {
        toast.error("Selecione pelo menos um serviço")
        return
      }
      set_current_step(EnumFormStep.SCHEDULE)
    }

    if (current_step === EnumFormStep.SCHEDULE) {
      // Verificar se pelo menos um dia está habilitado com horários configurados
      const scheduler = watch("scheduler")
      const hasEnabledDay = Object.values(scheduler).some(
        (day: any) => day.enabled && day.opening && day.closing
      )

      if (!hasEnabledDay) {
        toast.error("Configure pelo menos um dia com horários de abertura e fechamento")
        return
      }
      
      set_current_step(EnumFormStep.OBSERVATIONS)
    }
  }

  const goBackStep = () => {
    if (currentStepIndex > 0) {
      set_current_step(formSteps[currentStepIndex - 1].key as FormStep)
    }
  }

  const handleToggleageCategories = (
    fieldValue: AgeCategories,
    isSelected: boolean
  ) => {
    isSelected
      ? setValue("quem_atende", [...watch("quem_atende"), fieldValue])
      : setValue(
          "quem_atende",
          // @ts-ignore erro de array esperado
          watch("quem_atende").filter(
            (item: AgeCategories) => item !== fieldValue
          )
        )
  }

  const handleToggleAgreements = (
    isSelected: boolean,
    agreement_id: string
  ) => {
    isSelected
      ? setValue("agreements", [...(watch("agreements") || []), agreement_id])
      : setValue(
          "agreements",
          // @ts-ignore erro de array esperado
          (watch("agreements") || []).filter((id) => id !== agreement_id)
        )
  }

  const handleToggleSpecialties = (
    isSelected: boolean,
    specialty_id: string
  ) => {
    isSelected
      ? setValue("specialties", [...(watch("specialties") || []), specialty_id])
      : setValue(
          "specialties",
          // @ts-ignore erro de array esperado
          (watch("specialties") || []).filter((id) => id !== specialty_id)
        )
  }

  const filteredServices = services.filter(
    (service: Service) =>
      service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (service.description &&
        service.description.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  return {
    register,
    handleSubmit,
    onSubmit,
    watch,
    errors,
    setValue,
    current_step,
    currentStepIndex,
    currentProgress,
    nextStep,
    goBackStep,
    handleToggleageCategories,
    companyAgreements,
    handleToggleAgreements,
    handleToggleSpecialties,
    services,
    filteredServices,
    searchTerm,
    setSearchTerm,
    is_loading,
    setShowForm,
    specialties,
    existingProfessionals,
    selectProfessional,
    isCreatingNew,
    setIsCreatingNew,
    professionalSearchTerm,
    setProfessionalSearchTerm
  }
}

export default useCreateProfessionalModel
