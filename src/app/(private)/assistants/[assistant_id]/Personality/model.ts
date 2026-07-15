"use client"

import { AssistantsContext } from "@/contexts/Assistants"
import { Assistant } from "@/contexts/Assistants/interfaces"
import { useContext } from "react"

export interface IPersonalityModel {
  assistant: Assistant
}

const usePersonalityModel = (): IPersonalityModel => {
  const { assistant } = useContext(AssistantsContext)

  return { assistant }
}

export default usePersonalityModel
