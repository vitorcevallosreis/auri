import { UUID } from "crypto"

// Interface para metadados de serviços
export interface ServiceMetadata {
  id: number
  name?: string
  price?: number
  duration?: number
  mode?: "INDIVIDUAL" | "GRUPO" | "AMBOS"
  max_people?: number
}

// Interface para especialidades
export interface SpecialtyMetadata {
  id: string
  name: string
  description?: string
}

export interface Professional {
  id: UUID
  nome: string
  formacao: string
  especialidade: string
  registro: string
  atende_cat_idade: string[]
  convenios_aceitos: string[]
  horarios_atendimento: {
    friday: {
      closing: null | string
      enabled: boolean
      opening: null | string
    }
    monday: {
      closing: null | string
      enabled: boolean
      opening: null | string
    }
    sunday: {
      closing: null | string
      enabled: boolean
      opening: null | string
    }
    tuesday: {
      closing: null | string
      enabled: boolean
      opening: null | string
    }
    saturday: {
      closing: null | string
      enabled: boolean
      opening: null | string
    }
    thursday: {
      closing: null | string
      enabled: boolean
      opening: null | string
    }
    wednesday: {
      closing: null | string
      enabled: boolean
      opening: null | string
    }
  }
  email: string
  telefone: string
  observacoes: string | null
  search_tags: string[]
  created_at: string
  notificame_dia?: boolean
  notificame_horas?: boolean

  // Dados exigidos pela Memed para cadastrar o prescritor (migration 0026).
  // Opcionais de propósito: um profissional sem eles continua atendendo
  // normalmente — só não prescreve. `cpf` são 11 dígitos sem pontuação (há
  // CHECK no banco) e `data_nascimento` é ISO (YYYY-MM-DD).
  cpf?: string | null
  data_nascimento?: string | null
  conselho_sigla?: string | null
  conselho_numero?: string | null
  conselho_uf?: string | null
}

export interface ProfessionalAvailability {
  id: UUID
  professional_id: UUID
  service_id: UUID
  weekday: number // 1=Segunda, 2=Terça, etc.
  start_time: string
  end_time: string
  max_simultaneous_clients: number
  created_at: string
  updated_at: string
}

// Entrada de escrita: espelha as COLUNAS de `myia_professionals_medical`, não a
// interface `Professional` (que carrega campos derivados). Manter os dois
// separados evita mandar chave inexistente para o PostgREST, que rejeita a
// linha inteira com "column ... does not exist".
export interface NewProfessionalInput {
  company_id: string
  nome: string
  formacao?: string | null
  especialidade?: string | null
  registro?: string | null
  atende_cat_idade?: string[]
  convenios_aceitos?: string[]
  horarios_atendimento?: Record<string, unknown> | null
  email?: string | null
  telefone?: string | null
  observacoes?: string | null
  search_tags?: string[]
  notificame_dia?: boolean
  notificame_horas?: boolean
  cpf?: string | null
  data_nascimento?: string | null
  conselho_sigla?: string | null
  conselho_numero?: string | null
  conselho_uf?: string | null
}

export type ProfessionalUpdateInput = Partial<Omit<NewProfessionalInput, "company_id">>

// Um dia do seletor de horários do formulário.
export interface ProfessionalScheduleDay {
  enabled?: boolean
  opening?: string | null
  closing?: string | null
}

// Serviços + agenda semanal escolhidos no formulário de cadastro. É o que vira
// `myia_professional_services` e `myia_professional_availability` — sem estas
// duas, o profissional existe mas o agente nunca acha horário para ele.
export interface ProfessionalCatalogInput {
  services: Array<{
    service_id: string
    tipo?: "INDIVIDUAL" | "GRUPO" | "AMBOS"
    amount?: number
  }>
  scheduler: Record<string, ProfessionalScheduleDay>
}

export interface ProfessionalsContextType {
  professionals: Professional[]
  availability: ProfessionalAvailability[]
  loading: boolean
  error: string | null
  fetchProfessionals: (company_id: UUID) => Promise<void>
  fetchAvailability: (professionalId: UUID) => Promise<void>
  createProfessional: (
    professional: NewProfessionalInput,
    catalog?: ProfessionalCatalogInput
  ) => Promise<Professional | undefined>
  updateProfessional: (
    id: UUID,
    professional: ProfessionalUpdateInput
  ) => Promise<void>
  setProfessionalCatalog: (
    professionalId: UUID,
    catalog: ProfessionalCatalogInput
  ) => Promise<void>
  deleteProfessional: (id: UUID) => Promise<void>
  setAvailability: (
    availability: Omit<
      ProfessionalAvailability,
      "id" | "created_at" | "updated_at"
    >[]
  ) => Promise<void>
}
