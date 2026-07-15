import { Message } from "@/contexts/Chats/interfaces"

export interface IImageMessageModel {
  w_full: boolean
  message: Message
}

const useImageMessageModel = (
  w_full: boolean,
  message: Message
): IImageMessageModel => {
  return { w_full, message }
}

export default useImageMessageModel
