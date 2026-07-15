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

export interface ProfessionalsContextType {
  professionals: Professional[]
  availability: ProfessionalAvailability[]
  loading: boolean
  error: string | null
  fetchProfessionals: (company_id: UUID) => Promise<void>
  fetchAvailability: (professionalId: UUID) => Promise<void>
  createProfessional: (
    professional: Omit<Professional, "id" | "created_at" | "updated_at">
  ) => Promise<Professional | undefined>
  updateProfessional: (
    id: UUID,
    professional: Partial<Professional>
  ) => Promise<void>
  deleteProfessional: (id: UUID) => Promise<void>
  setAvailability: (
    availability: Omit<
      ProfessionalAvailability,
      "id" | "created_at" | "updated_at"
    >[]
  ) => Promise<void>
}
