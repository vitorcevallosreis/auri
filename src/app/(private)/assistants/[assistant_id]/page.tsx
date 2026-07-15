"use client"

import useAssistantPageModel from "./model"
import AssistantPageView from "./view"

export default function AssistantPage() {
  const assistantPageModel = useAssistantPageModel()

  return <AssistantPageView {...assistantPageModel} />
}
