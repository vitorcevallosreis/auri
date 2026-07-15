import { Message } from "@/contexts/Chats/interfaces"
import useDocumentMessageModel from "./model"
import DocumentMessageView from "./view"

interface DocumentMessageProps {
  message: Message
}

export default function DocumentMessage({ message }: DocumentMessageProps) {
  const DocumentMessageModel = useDocumentMessageModel(message)

  return <DocumentMessageView {...DocumentMessageModel} />
}
