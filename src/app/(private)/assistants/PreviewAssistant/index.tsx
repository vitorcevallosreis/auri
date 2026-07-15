"use client"

import { Assistant } from "@/contexts/Assistants/interfaces"
import usePreviewAssistantModel from "./model"
import PreviewAssistantView from "./view"

interface PreviewAssistantProps {
  assistant: Assistant
}

export default function PreviewAssistant({ assistant }: PreviewAssistantProps) {
  const previewAssistantModel = usePreviewAssistantModel(assistant)

  return <PreviewAssistantView {...previewAssistantModel} />
}
