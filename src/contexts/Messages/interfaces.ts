import { Dispatch, SetStateAction } from "react"
import { MessageSchemaTyped, MessagesSchemaTyped } from "./schemas"

export interface MessagesProps {
  children: React.ReactNode
}

export interface MessagesType {
  isLoading: boolean
  isLoadingMore: boolean
  hasMoreMessages: boolean
  messages: MessagesSchemaTyped
  message: MessageSchemaTyped
  set_message: Dispatch<SetStateAction<MessageSchemaTyped>>
  message_info: string | null
  set_message_info: Dispatch<SetStateAction<string | null>>
  
  // Estado de uploads
  upload_file?: (files: any) => Promise<any>
  upload_audio?: (audio: any) => Promise<string>
  audio_status?: any

  // Funções de paginação
  loadMoreMessages: () => void

  // Funções de envio de mensagem
  send_text_message: (chat_id: string, message: string) => Promise<void>
  send_audio_message: (chat_id: string, audio: any) => Promise<void>
  send_image_message: (chat_id: string, image: File, caption?: string) => Promise<void>
  send_document_message: (chat_id: string, document: File, caption?: string) => Promise<void>
  send_midia_message: (chat_id: string, midia: File, caption?: string) => Promise<void>
  send_location_message: (chat_id: string, location: any) => Promise<void>
  
  // Funções de digitação
  sendTypingIndicator: (chat_id: string, isTyping?: boolean) => Promise<void>
  typingContacts?: Record<string, boolean>
  setTypingContacts?: Dispatch<SetStateAction<Record<string, boolean>>>
}

export interface Defaults {
  isLoading: boolean
  messages: MessagesSchemaTyped
  message: MessageSchemaTyped
  message_info: string | null
}
