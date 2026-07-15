import { Message } from "@/contexts/Chats/interfaces"

export interface IStickerMessageModel {
  message: Message
}

const useStickerMessageModel = (message: Message): IStickerMessageModel => {
  return { message }
}

export default useStickerMessageModel
