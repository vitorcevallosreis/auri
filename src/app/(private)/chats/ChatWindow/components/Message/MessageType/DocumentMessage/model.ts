import { Message } from "@/contexts/Chats/interfaces"

export interface IDocumentMessageModel {
  message: Message
}

const useDocumentMessageModel = (message: Message): IDocumentMessageModel => {
  return { message }
}

export default useDocumentMessageModel
