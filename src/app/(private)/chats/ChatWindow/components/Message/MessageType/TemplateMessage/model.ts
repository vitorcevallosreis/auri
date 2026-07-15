import { Message } from "@/contexts/Chats/interfaces"

export interface ITemplateMessageModel {
  message: Message
}

const useTemplateMessageModel = (message: Message): ITemplateMessageModel => {
  return { message }
}

export default useTemplateMessageModel
