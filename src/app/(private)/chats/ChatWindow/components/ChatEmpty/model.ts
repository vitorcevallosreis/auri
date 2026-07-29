"use client"

import { useContext } from "react"
import { ChatsContext } from "@/contexts/Chats"

export interface ChatEmptyContact {
  chat_id: string
  name: string
  avatar_url: string | null
  /** Prévia da última mensagem, para dar contexto no menu. Pode vir vazia. */
  last_message: string
}

export interface IChatEmptyModel {
  contacts: ChatEmptyContact[]
  openChat: (chat_id: string) => void
}

/** Quantas pessoas o menu do "+" lista. Acima disso vira uma lista rolável. */
const MAX_CONTATOS = 8

const useChatEmptyModel = (): IChatEmptyModel => {
  // `chats` já vem carregado pelo ChatsContext — a ChatList (irmã desta tela)
  // dispara o getChats. Não buscamos nada aqui de propósito: o estado vazio não
  // deve gerar requisição própria nem competir com a lista.
  const { chats, set_selected_chat_windows } = useContext(ChatsContext)

  // Só conversas existentes. O app hoje não sabe CRIAR conversa (não há insert
  // em myia_chat em lugar nenhum, e o "Novo Chat" tem onSubmit stub), então
  // listar contatos sem conversa daria itens que não levariam a lugar nenhum.
  const contacts: ChatEmptyContact[] = [...chats]
    .sort((a, b) => {
      // Mais recentes primeiro. updated_at é nullable no schema; nulos vão pro fim.
      const ta = a.updated_at ? Date.parse(a.updated_at) : 0
      const tb = b.updated_at ? Date.parse(b.updated_at) : 0
      return tb - ta
    })
    .slice(0, MAX_CONTATOS)
    .map((chat) => ({
      chat_id: chat.id,
      name: chat.contact.name,
      avatar_url: chat.contact.avatar_url ?? null,
      last_message: chat.last_message?.conversation ?? "",
    }))

  const openChat = (chat_id: string) => set_selected_chat_windows(chat_id)

  return { contacts, openChat }
}

export default useChatEmptyModel
