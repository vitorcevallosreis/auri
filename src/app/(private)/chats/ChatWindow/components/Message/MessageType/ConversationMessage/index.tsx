import React from "react"
import useConversationMessageModel from "./model"
import ConversationMessageView from "./view"
import { MessageSchemaTyped } from "@/contexts/Messages/schemas"

interface ConversationMessageProps {
  w_full: boolean
  message: MessageSchemaTyped
}

export default function ConversationMessage({
  w_full,
  message,
}: ConversationMessageProps) {
  const conversationMessageModel = useConversationMessageModel(w_full, message)

  return <ConversationMessageView {...conversationMessageModel} />
}
