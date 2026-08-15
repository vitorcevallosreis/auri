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

// Uma faixa de atendimento contínua. O dia é uma LISTA delas, não um par
// abertura/fechamento: é assim que o intervalo de almoço existe. O banco sempre
// permitiu várias linhas por (profissional, serviço, dia); só o formulário de
// cadastro é que ainda enxerga uma janela só.
export interface JanelaDeAtendimento {
  opening: string
  closing: string
}

/** Agenda semanal como o banco a guarda: várias janelas por dia. */
export type AgendaSemanal = Record<string, JanelaDeAtendimento[]>

export interface ProfessionalServiceInput {
  service_id: string
  tipo?: "INDIVIDUAL" | "GRUPO" | "AMBOS"
  amount?: number
  max_pessoas?: number
}

/** Serviços + agenda de um profissional JÁ cadastrado, para editar. */
export interface ProfessionalCatalogSnapshot {
  services: Array<Required<Pick<ProfessionalServiceInput, "service_id">> & ProfessionalServiceInput>
  agenda: AgendaSemanal
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
  /** Lê serviços + agenda de quem já está cadastrado (para a tela de edição). */
  loadProfessionalCatalog: (
    professionalId: UUID
  ) => Promise<ProfessionalCatalogSnapshot>
  /** Grava SUBSTITUINDO: o que o usuário tirou some do banco. */
  replaceProfessionalCatalog: (
    professionalId: UUID,
    catalog: ProfessionalCatalogSnapshot
  ) => Promise<void>
  deleteProfessional: (id: UUID) => Promise<void>
  setAvailability: (
    availability: Omit<
      ProfessionalAvailability,
      "id" | "created_at" | "updated_at"
    >[]
  ) => Promise<void>
}
