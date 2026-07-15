"use client"

import useAssistantSettingsModel from "./model"
import AssistantSettingsView from "./view"

export default function AssistantSettings() {
  const assistantSettingsModel = useAssistantSettingsModel()

  return <AssistantSettingsView {...assistantSettingsModel} />
}
