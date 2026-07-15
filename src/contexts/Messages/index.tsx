"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import { MessagesProps, MessagesType } from "./interfaces"
import { supabase } from "@/lib/supabase/config"
import { toast } from "sonner"
import { Default } from "./defaults"
import SUPA_TABLES from "../supa_tables"
import { ChatsContext } from "../Chats"
import { EnumMessageTyped, MessageSchemaTyped, MessagesSchema } from "./schemas"
import { realtimeService } from "@/lib/supabase/realtime.service"
import { ReceiveMessage, UpdateStatusMessage } from "./function"
import useSound from "use-sound"
import { AxiosHttpClientAdapter } from "@/lib/webhooks/api"
import { get_midia_type } from "./utils"
import { v4 as uuidv4 } from "uuid"
import { messageService } from "@/services/MessageService"

export const MessagesContext = createContext({} as MessagesType)

export function MessagesProvider({ children }: MessagesProps) {
  const httpClient = new AxiosHttpClientAdapter()

  const { selected_chat_windows } = useContext(ChatsContext)

  const [isLoading, setisLoading] = useState(Default.isLoading)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMoreMessages, setHasMoreMessages] = useState(true)
  const [page, setPage] = useState(1)
  const messagesPerPage = 30 // Número de mensagens por página
  const [messages, setMessages] = useState(Default.messages)
  const [message, set_message] = useState(Default.message)
  const [message_info, set_message_info] = useState(Default.message_info)
  // Estado para rastrear quais contatos estão digitando (id do chat -> estado)
  const [typingContacts, setTypingContacts] = useState<Record<string, boolean>>(
    {}
  )

  const [playSound] = useSound("/sounds/new-message.mp3")

  useEffect(() => {
    if (!selected_chat_windows) return

    // Resetar paginação quando mudar de chat
    setPage(1)
    setHasMoreMessages(true)
    getMessages(selected_chat_windows)
  }, [selected_chat_windows])

  useEffect(() => {
    realtimeService.subscribeToTable<MessageSchemaTyped>(
      SUPA_TABLES.table_myia_messages,
      (payload) => {
        if (payload.eventType === "INSERT") {
          console.timeEnd("Tempo até mensagem no realtime")
          
          // Sempre processar a mensagem, independentemente do chat selecionado
          if (selected_chat_windows && payload.new.chat_id === selected_chat_windows) {
            ReceiveMessage(
              setMessages,
              payload.new,
              selected_chat_windows,
              playSound
            )
          }

          
          // Atualização da lista de chats removida para evitar conflitos de tipos; Realtime de chats já trata isso
        }

        if (payload.eventType === "UPDATE") {
          UpdateStatusMessage(setMessages, payload.new)
        }
      }
    )

    return () => {
      realtimeService.unsubscribeFromTable(SUPA_TABLES.table_myia_messages)
    }
  }, [selected_chat_windows])

  // Função atualizada para paginação
  async function getMessages(chat_id: string, loadMore = false): Promise<void> {
    if (!chat_id) return

    if (loadMore) {
      setIsLoadingMore(true)
    } else {
      setisLoading(true)
      setMessages([]) // Limpar mensagens ao mudar de chat
    }

    try {
      // Calcular o range com base na página atual
      const rangeStart = loadMore ? messages.length : 0
      const rangeEnd = rangeStart + messagesPerPage - 1

      console.log(`Carregando mensagens de ${rangeStart} a ${rangeEnd}`)

      const { data, error } = await supabase
        .from(SUPA_TABLES.table_myia_messages)
        .select("*")
        .eq("chat_id", chat_id)
        .order("created_at", { ascending: true })
        .range(rangeStart, rangeEnd)

      if (error) throw error

      // Verificar se temos mais mensagens para carregar
      setHasMoreMessages(data && data.length === messagesPerPage)

      if (!data || data.length === 0) {
        if (!loadMore) {
          setMessages([])
        }
        return
      }

      const parsed = MessagesSchema.safeParse(data)

      console.log("####### parsed", parsed.error)

      if (!parsed.success) throw "[getMessages]: => Safe Parse Error!"

      // Adicionar mensagens ao estado de forma otimizada
      setMessages((prevMessages) => {
        if (loadMore) {
          // Combinar mensagens antigas com novas, garantindo ordem
          return [...prevMessages, ...data].sort((a, b) => {
            return (
              new Date(a.created_at).getTime() -
              new Date(b.created_at).getTime()
            )
          })
        } else {
          // Apenas novas mensagens (ao trocar de chat)
          return data
        }
      })
    } catch (error) {
      console.error("Erro ao carregar mensagens:", error)
      if (!loadMore) {
        setMessages(Default.messages)
      }
    } finally {
      setisLoading(false)
      setIsLoadingMore(false)
    }
  }

  // Função para carregar mais mensagens
  function loadMoreMessages() {
    if (!selected_chat_windows || isLoadingMore || !hasMoreMessages) return

    console.log("Carregando mais mensagens...")
    setPage((prevPage) => prevPage + 1)
    getMessages(selected_chat_windows, true)
  }

  async function send_text_message(
    chat_id: string,
    message: string
  ): Promise<void> {
    if (!chat_id || !message) return

    const messageToSend = message.trim()

    // Limpar estado de mensagem selecionada (mantém tipagem correta)
    set_message(Default.message)

    // Ativar indicador de digitação
    sendTypingIndicator(chat_id, true)
    try {
      await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id,
          message_type: 'text',
          content: { conversation: messageToSend },
          from_me: true,
        })
      })
      // Desativar indicador de digitação após disparo
      sendTypingIndicator(chat_id, false)
    } catch (error) {
      console.error("Erro ao acionar envio de mensagem:", error)
      toast.error("Erro ao enviar a mensagem.")
      sendTypingIndicator(chat_id, false)
    }
  }

  async function send_audio_message(
    chat_id: string,
    audio: File
  ): Promise<void> {
    if (!chat_id || !audio) {
      console.error("Parâmetros inválidos:", { chat_id, hasAudio: !!audio })
      toast.error("Não foi possível enviar o áudio: parâmetros inválidos")
      return
    }

    try {
      await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id,
          message_type: 'audio',
          content: { name: audio.name, mime: audio.type },
          from_me: true,
        })
      })
      toast.success("Áudio em envio")
    } catch (error) {
      console.error("Erro na função send_audio_message:", error)
      toast.error("Erro ao processar o envio de áudio")
    }
  }

  async function send_midia_message(
    chat_id: string,
    midia: File,
    caption?: string
  ): Promise<void> {
    if (!chat_id || !midia) return

    try {
      // Determinar o tipo de mídia com base no mime type
      const midia_type = get_midia_type(midia)
      console.log(`Tipo de mídia detectado: ${midia_type}`)

      // Redirecionar para a função específica com base no tipo
      if (midia_type === EnumMessageTyped.IMAGE_MESSAGE) {
        return send_image_message(chat_id, midia, caption)
      } else if (midia_type === EnumMessageTyped.AUDIO_MESSAGE) {
        return send_audio_message(chat_id, midia)
      } else if (midia_type === EnumMessageTyped.DOCUMENT_MESSAGE) {
        return send_document_message(chat_id, midia, caption)
      } else if (midia_type === EnumMessageTyped.VIDEO_MESSAGE) {
        // Tratar vídeos como documentos por enquanto
        console.log("Tratando vídeo como documento")
        return send_document_message(chat_id, midia, caption)
      } else {
        // Tipo desconhecido, usar documento como fallback
        console.warn(
          `Tipo de mídia não reconhecido: ${midia.type}, tratando como documento`
        )
        return send_document_message(chat_id, midia, caption)
      }
    } catch (error) {
      console.error("Erro ao processar mídia:", error)
      toast.error("Erro ao processar o arquivo de mídia")
    }
  }

  async function send_image_message(
    chat_id: string,
    image: File,
    caption?: string
  ): Promise<void> {
    if (!chat_id || !image) {
      console.error("Parâmetros inválidos para envio de imagem:", {
        chat_id,
        hasImage: !!image,
      })
      toast.error("Não foi possível enviar a imagem: parâmetros inválidos")
      return
    }

    try {
      // 1) Presign para imagem
      const presignRes = await fetch('/api/upload/image/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id, contentType: image.type, ext: image.name.split('.').pop() || 'jpg' })
      })
      if (!presignRes.ok) throw new Error('Falha ao gerar URL assinada para imagem')
      const { uploadUrl, objectUrl } = await presignRes.json()

      // 2) PUT do arquivo diretamente no MinIO
      await fetch(uploadUrl, { method: 'PUT', body: image })

      // 3) Enviar mensagem com URL pública
      await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id,
          message_type: 'image',
          content: { url: objectUrl, mimetype: image.type, fileName: image.name, caption },
          from_me: true,
        })
      })
      toast.success("Imagem em envio")
    } catch (error) {
      console.error("Erro na função send_image_message:", error)
      toast.error("Erro ao processar o envio de imagem")
    }
  }

  async function send_document_message(
    chat_id: string,
    document: File,
    caption?: string
  ): Promise<void> {
    if (!chat_id || !document) {
      console.error("Parâmetros inválidos para envio de documento:", {
        chat_id,
        hasDocument: !!document,
      })
      toast.error("Não foi possível enviar o documento: parâmetros inválidos")
      return
    }

    try {
      // 1) Presign para documento
      const presignRes = await fetch('/api/upload/document/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id, contentType: document.type, ext: document.name.split('.').pop() || 'pdf' })
      })
      if (!presignRes.ok) throw new Error('Falha ao gerar URL assinada para documento')
      const { uploadUrl, objectUrl } = await presignRes.json()

      // 2) PUT do arquivo diretamente no MinIO
      await fetch(uploadUrl, { method: 'PUT', body: document })

      // 3) Enviar mensagem com URL pública
      await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id,
          message_type: 'document',
          content: { url: objectUrl, mimetype: document.type, fileName: document.name, caption },
          from_me: true,
        })
      })
      toast.success("Documento em envio")
    } catch (error) {
      console.error("Erro na função send_document_message:", error)
      toast.error("Erro ao processar o envio de documento")
    }
  }

  // Implementação otimizada do indicador de digitação com debounce
  const lastTypingIndicatorSent = React.useRef<number | null>(null)
  const typingTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)

  async function sendTypingIndicator(_chat_id: string, _isTyping?: boolean) {
    // No-op temporário: indicador de digitação desativado por solicitação
    return
  }

  async function send_message(
    chat_id: string,
    message: string,
    type: "text" | "image" | "audio" | "video" | "document" = "text"
  ): Promise<void> {
    // Função legada, mantida para compatibilidade
    if (type === "text") {
      await send_text_message(chat_id, message)
    }
  }

  async function get_chat_messages(
    id: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<any> {
    try {
      const { data, error } = await supabase
        .from(SUPA_TABLES.table_myia_messages)
        .select("*")
        .eq("chat_id", id)
        .order("created_at", { ascending: false })
        .limit(limit)
        .range(offset, offset + limit - 1)
      if (error) throw error
      if (!data) return
      return data
    } catch (error) {
      console.log(error)
    }
  }

  return (
    <MessagesContext.Provider
      value={{
        messages,
        message,
        set_message,
        message_info,
        set_message_info,
        isLoading,
        isLoadingMore,
        hasMoreMessages,
        loadMoreMessages,
        send_text_message,
        send_audio_message,
        send_midia_message,
        send_image_message,
        send_document_message,
        send_location_message: async () => {},
        sendTypingIndicator,
        typingContacts,
        setTypingContacts,
      }}
    >
      {children}
    </MessagesContext.Provider>
  )
}
