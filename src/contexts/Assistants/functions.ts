import { supabase } from "@/lib/supabase/config"
import SUPA_TABLES from "../supa_tables"
import { Assistant, BodyCreateAssistant } from "./interfaces"

interface OnCreateAssistantResponse<T> {
  success: boolean
  data: T | null
}

export const OnCreateAssistant = async (
  company_id: string,
  body: BodyCreateAssistant
): Promise<OnCreateAssistantResponse<Assistant>> => {
  try {
    const created_assistant_data = await CreateAssistant(company_id, body)

    if (!created_assistant_data.data?.id) return { success: false, data: null }

    await CreateSettingsAssistant(created_assistant_data.data?.id)

    await CreateChannel(created_assistant_data.data?.id)

    return { success: false, data: created_assistant_data.data }
  } catch (error) {
    console.log(`[OnCreateAssistant]: Erro ao criar Assistante: `, error)

    return { success: false, data: null }
  }
}

interface CreateAssistantResponse<T> {
  success: boolean
  data?: T | null
}

const CreateAssistant = async (
  company_id: string,
  body: BodyCreateAssistant
): Promise<CreateAssistantResponse<Assistant>> => {
  try {
    const { data, error }: { data: Assistant | null; error: any } =
      await supabase
        .from(SUPA_TABLES.table_assistants)
        .insert({ ...body, company_id: company_id })
        .select()
        .single()

    if (error) throw error

    return { success: true, data: data }
  } catch (error) {
    console.log(`[CreateAssistant]: Erro ao criar Assistante: `, error)
    return { success: false, data: null }
  }
}

const CreateSettingsAssistant = async (
  assistant_id: string
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from(SUPA_TABLES.table_settings_assistants)
      .insert({ assistant_id: assistant_id })

    if (error) throw error

    return true
  } catch (error) {
    console.log(
      `[CreateSettingsAssistant]: Erro ao criar Configuração do Assistante: `,
      error
    )
    return false
  }
}

const CreateChannel = async (assistant_id: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from(SUPA_TABLES.table_myia_channels)
      .insert({ assistant_id: assistant_id, status: "created" })
      .select()
      .single()

    if (error) throw error

    return true
  } catch (error) {
    console.log(`[CreateChannel]: Erro ao criar Canal do Assistante: `, error)

    return false
  }
}
