"use client"

import useCreateAssistantModel from "./model"
import CreateAssistantView from "./view"

export default function CreateAssistant() {
  const createAssistantModel = useCreateAssistantModel()

  return <CreateAssistantView {...createAssistantModel} />
}
