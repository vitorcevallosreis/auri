import { Message } from "@/contexts/Chats/interfaces"
import useImageMessageModel from "./model"
import ImageMessageView from "./view"

interface ImageMessageProps {
  w_full: boolean
  message: Message
}

export default function ImageMessage({ w_full, message }: ImageMessageProps) {
  const ImageMessageModel = useImageMessageModel(w_full, message)

  return <ImageMessageView {...ImageMessageModel} />
}
