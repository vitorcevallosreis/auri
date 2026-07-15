"use client"

import { Assistant } from "@/contexts/Assistants/interfaces"
import { useDisclosure } from "@nextui-org/react"

export interface IPreviewAssistantModel {
  assistant: Assistant

  isOpen: boolean
  onOpen: () => void
  onOpenChange: (open: boolean) => void
}

const usePreviewAssistantModel = (
  assistant: Assistant
): IPreviewAssistantModel => {
  const { isOpen, onOpen, onOpenChange } = useDisclosure()

  return { isOpen, onOpen, onOpenChange, assistant }
}

export default usePreviewAssistantModel
