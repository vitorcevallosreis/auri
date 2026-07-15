import { Message } from "@/contexts/Chats/interfaces"
import useStickerMessageModel from "./model"
import StickerMessageView from "./view"

interface StickerMessageProps {
  message: Message
}

export default function StickerMessage({ message }: StickerMessageProps) {
  const StickerMessageModel = useStickerMessageModel(message)

  return <StickerMessageView {...StickerMessageModel} />
}
