"use client"

import { ChatsContext } from "@/contexts/Chats"
import { MessagesContext } from "@/contexts/Messages"
import { useContext } from "react"

export interface IChatWindowModel {
  selected_chat_windows: string | null
  isLoading: boolean
}

const useChatWindowModel = (): IChatWindowModel => {
  const { selected_chat_windows } = useContext(ChatsContext)
  const { isLoading } = useContext(MessagesContext)

  return { selected_chat_windows, isLoading }
}

export default useChatWindowModel
