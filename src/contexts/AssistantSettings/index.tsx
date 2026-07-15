"use client"

import React, { createContext, useState } from "react"
import {
  AssistantSettings,
  AssistantSettingsContextType,
  AssistantSettingsProps,
} from "./interfaces"
import { supabase } from "@/lib/supabase/config"
import { toast } from "sonner"
import { Default } from "./defaults"
import SUPA_TABLES from "../supa_tables"

export const AssistantSettingsContext = createContext(
  {} as AssistantSettingsContextType
)

export function AssistantSettingsProvider({
  children,
}: AssistantSettingsProps) {
  const [isLoading, setIsLoading] = useState(Default.isLoading)
  const [assistant_settings, set_assistant_settings] = useState(
    Default.assistant_settings
  )

  async function getSettingsAssistants(assistant_id: string): Promise<void> {
    if (!assistant_id) return

    setIsLoading(true)

    try {
      const { data, error }: { data: AssistantSettings | null; error: any } =
        await supabase
          .from(SUPA_TABLES.table_settings_assistants)
          .select()
          .match({ assistant_id: assistant_id })
          .single()

      if (error) throw error
      if (!data) throw "Dados inválidos!"

      set_assistant_settings(data)
    } catch (error) {
      toast.error("Erro ao listar os Assistentes")

      console.log(error)
      set_assistant_settings(Default.assistant_settings)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AssistantSettingsContext.Provider
      value={{
        isLoading,
        getSettingsAssistants,
        assistant_settings,
      }}
    >
      {children}
    </AssistantSettingsContext.Provider>
  )
}
