import { Message } from "@/contexts/Chats/interfaces"

export interface IVideoMessageModel {
  w_full: boolean
  message: Message
}

const useVideoMessageModel = (
  w_full: boolean,
  message: Message
): IVideoMessageModel => {
  return { w_full, message }
}

export default useVideoMessageModel
