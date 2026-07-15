"use client"

import useAssistantsPageModel from "./model"
import AssistantsPageView from "./view"

export default function AssistantsPage() {
  const assistantsPageModel = useAssistantsPageModel()

  return <AssistantsPageView {...assistantsPageModel} />
}
