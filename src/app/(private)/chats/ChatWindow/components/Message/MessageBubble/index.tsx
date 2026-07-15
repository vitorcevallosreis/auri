import React, { Dispatch, SetStateAction } from "react"
import useMessageBubbleModel from "./model"
import MessageBubbleView from "./view"
import { MessageSchemaTyped } from "@/contexts/Messages/schemas"

export interface MessageBubbleProps {
  openMessageId: string | null
  setOpenMessageId: Dispatch<SetStateAction<string | null>>
  handleContextMenu: (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
    messageId: string
  ) => void
  w_full: boolean
  actions: boolean
  message: MessageSchemaTyped
}

export default function MessageBubble({
  openMessageId,
  setOpenMessageId,
  handleContextMenu,
  w_full,
  actions,
  message,
}: MessageBubbleProps) {
  const messageBubbleModel = useMessageBubbleModel(
    openMessageId,
    setOpenMessageId,
    handleContextMenu,
    w_full,
    actions,
    message
  )

  return <MessageBubbleView {...messageBubbleModel} />
}
