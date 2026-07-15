"use client"

import { AssistantSettingsContext } from "@/contexts/AssistantSettings"
import { AssistantSettings } from "@/contexts/AssistantSettings/interfaces"
import { AssistantsContext } from "@/contexts/Assistants"
import { useContext, useEffect, useState } from "react"

export interface IAssistantSettingsModel {
  isLoading: boolean
  assistant_settings: AssistantSettings
  percentageUsed: number
  percentageAvailable: number
}

const useAssistantSettingsModel = (): IAssistantSettingsModel => {
  const { assistant } = useContext(AssistantsContext)
  const { isLoading, getSettingsAssistants, assistant_settings } = useContext(
    AssistantSettingsContext
  )

  const [percentageUsed, setPercentageUsed] = useState(0)
  const [percentageAvailable, setPercentageAvailable] = useState(0)

  useEffect(() => {
    if (!assistant.id) return

    getSettingsAssistants(assistant.id)
  }, [assistant])

  useEffect(() => {
    const availableTokens = assistant_settings?.available_tokens || 0
    const usedTokens = assistant_settings?.used_tokens || 0

    const percentageUsed =
      availableTokens > 0 ? (usedTokens / availableTokens) * 100 : 0

    const percentageAvailable = 100 - percentageUsed

    setPercentageUsed(percentageUsed)
    setPercentageAvailable(percentageAvailable)
  }, [assistant_settings])

  return { isLoading, assistant_settings, percentageUsed, percentageAvailable }
}

export default useAssistantSettingsModel
