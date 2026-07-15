export interface AssistantsProviderProps {
  children: React.ReactNode
}

export interface AssistantsContextType {
  isLoading: boolean
  setIsLoading: (value: boolean) => void
  getAssistants: () => Promise<void>
  assistants: Assistant[]
  getAssistant: (assistant_id: string) => Promise<void>
  assistant: Assistant
  createAssistant: (body: BodyCreateAssistant) => Promise<boolean>
  updateAssistant: (
    assistant_id: string,
    body: BodyCreateAssistant
  ) => Promise<void>
  deleteAssistant: (assistant_id: string) => Promise<void>
  getEnabledLlms: () => Promise<void>
  llms: Llm[]

  getChannels: () => Promise<Channel[]>
  getChannel: (channel_id?: string) => Promise<Channel | null>
  channel: Channel
  set_channel: (channel: Channel) => void
  removeConnectionChannel: (channel_id: string) => Promise<void>
  createChannel: (channel_name?: string, apiType?: "Evolution" | "Waha") => Promise<Channel | null>
  generateQRCode: (channel_id?: string) => Promise<void>
  deleteChannel: (channel_id: string) => Promise<boolean>
  
  // Follow-up steps
  followUpSteps: FollowUpStep[]
  getFollowUpSteps: (assistant_id: string) => Promise<void>
  createFollowUpStep: (assistant_id: string, body: BodyFollowUpStep) => Promise<void>
  updateFollowUpStep: (id: string, body: BodyFollowUpStep) => Promise<void>
  deleteFollowUpStep: (id: string) => Promise<void>
}

export interface Defaults {
  isLoading: boolean
  assistants: Assistant[]
  assistant: Assistant
  llms: Llm[]
  channel: Channel
  followUpSteps: FollowUpStep[]
}

export interface Assistant {
  id: string
  name: string
  company_id: string
  paused: boolean
  purpose: string | null
  description: string | null
  avatar: string | null
  llm: string | null
  objective: string | null
  identity: string | null
  greetings: string | null
  strategy: string | null
  behavior: string | null
  behavior_text: string | null
  fallbacks: string | null
  avoided_topics: string | null
  step_by_step: string | null
  goodbye: string | null
  roles: string | null
  tel_fallback: string | null
}

export interface Llm {
  id: string
  name: string
  enabled: boolean
  icon: string | null
}

export interface BodyCreateAssistant
  extends Omit<Assistant, "id" | "paused" | "company_id"> {}

export interface BodyCreateSettingsAssistant {
  id: string
}

export type ChannelStatus = "open" | "close" | "created"
export enum EnumChannelStatus {
  OPEN = "open",
  CLOSE = "close",
  CREATED = "created",
}

export interface Channel {
  id: string
  created_at: string
  nome: string
  tipoConexao: string
  titular: string
  assistant_id: string
  ultimaAtualizacao: string
  numeroTel: string
  fotoPerfil: string
  token: string
  urlapi: string
  apiUtilizada: string
  status: ChannelStatus
  qrcode64: string
  pairing_code: string
  looping_qrcode: number
  instanceWpp: string
  remoteJid: string
}

// Follow-up step interfaces
export interface FollowUpStep {
  id: string
  company_id: string
  assistant_id: string
  step_number: number
  delay_minutes: number
  message: string
  auto_close: boolean
  created_at: string
  updated_at: string
}

export interface BodyFollowUpStep {
  step_number: number
  delay_minutes: number
  message: string
  auto_close: boolean
}
