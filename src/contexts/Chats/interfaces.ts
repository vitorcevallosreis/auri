import { Dispatch, SetStateAction } from "react"
import { ChatSchemaTyped } from "./schemas"

export interface ChatsProps {
  children: React.ReactNode
}

export interface ChatsType {
  isLoading: boolean
  getChats: (archived?: boolean) => Promise<void>
  chats: Chat[]
  selected_chat_windows: string | null
  set_selected_chat_windows: Dispatch<SetStateAction<string | null>>
  getChat: (chat_id: string) => Promise<void>
  chat: Chat
  getChatControll: (chat_id: string) => Promise<void>
  muteAndUnmuteChat: (chat_id: string, muted: boolean) => Promise<void>
  updateChatLabels: (chat_id: string, labels: string[]) => Promise<void>
  toggleChatPause: (chat_id: string) => Promise<void>
}

export interface Defaults {
  isLoading: boolean
  chat: Chat
  chats: Chat[]
}

export interface Chat extends ChatSchemaTyped {}
