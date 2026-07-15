export interface AssistantSettingsProps {
  children: React.ReactNode
}

export interface AssistantSettingsContextType {
  isLoading: boolean
  getSettingsAssistants: (assistant_id: string) => Promise<void>
  assistant_settings: AssistantSettings
}

export interface Defaults {
  isLoading: boolean
  assistant_settings: AssistantSettings
}

export interface AssistantSettings {
  id: string
  instance_conection: string
  used_tokens: number
  available_tokens: number
  assistant_id: string
  created_at: string
}
