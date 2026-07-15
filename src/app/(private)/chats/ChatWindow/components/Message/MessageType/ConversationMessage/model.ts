import { MessageSchemaTyped } from "@/contexts/Messages/schemas"

export interface IFormattedTextPart {
  bold?: boolean
  content?: string
}

export interface IConversationMessageModel {
  w_full: boolean
  message: MessageSchemaTyped
}

const useConversationMessageModel = (
  w_full: boolean,
  message: MessageSchemaTyped
): IConversationMessageModel => {
  return { w_full, message }
}

export default useConversationMessageModel
