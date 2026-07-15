import { Dispatch, SetStateAction } from "react"
import { MessageBubbleProps } from "."
import { MessageSchemaTyped } from "@/contexts/Messages/schemas"

export interface IMessageBubbleModel extends MessageBubbleProps {
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

const useMessageBubbleModel = (
  openMessageId: string | null,
  setOpenMessageId: Dispatch<SetStateAction<string | null>>,
  handleContextMenu: (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
    messageId: string
  ) => void,
  w_full: boolean,
  actions: boolean,
  message: MessageSchemaTyped
): IMessageBubbleModel => {
  return {
    openMessageId,
    setOpenMessageId,
    handleContextMenu,
    w_full,
    actions,
    message,
  }
}

export default useMessageBubbleModel
