import { Message } from "@/contexts/Chats/interfaces"
import useTemplateMessageModel from "./model"
import TemplateMessageView from "./view"

interface TemplateMessageProps {
  message: Message
}

export default function TemplateMessage({ message }: TemplateMessageProps) {
  const TemplateMessageModel = useTemplateMessageModel(message)

  return <TemplateMessageView {...TemplateMessageModel} />
}
