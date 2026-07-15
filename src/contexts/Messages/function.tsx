import { Dispatch, SetStateAction } from "react"
import { MessageSchemaTyped } from "./schemas"

// Adiciona a Mensagem alvo no Estado da mensage
export const ReceiveMessage = (
  setMessages: Dispatch<SetStateAction<MessageSchemaTyped[]>>,
  payload: MessageSchemaTyped,
  selected_chat_windows: string,
  playSound: () => void
) => {
  if (payload.chat_id !== selected_chat_windows) return

  setMessages((prevMessages) => {
    const messageExists = prevMessages.some((msg) => msg.id === payload.id)
    if (messageExists) return prevMessages

    const ts = (m: Partial<MessageSchemaTyped>) => {
      if (m?.created_at) return new Date(m.created_at as string).getTime()
      if (typeof m?.message_timestamp === "number")
        return (m.message_timestamp as number) * 1000
      return Date.now()
    }
    return [...prevMessages, payload].sort((a, b) => ts(a) - ts(b))
  })

  if (!payload.from_me) {
    try {
      playSound()
    } catch {}
  }
}

export const UpdateStatusMessage = (
  setMessages: Dispatch<SetStateAction<MessageSchemaTyped[]>>,
  payload: Partial<MessageSchemaTyped>
) => {
  const hasFullMessage = !!payload.message

  setMessages((prevMessages) =>
    prevMessages.map((message) => {
      const isMatch =
        message.id === payload.id ||
        (payload.message_id && message.id === payload.message_id)

      if (!isMatch) return message

      if (hasFullMessage && payload.message?.audioMessage) {
        return {
          ...message,
          status: (payload.status as any) || message.status,
          message: {
            ...message.message,
            audioMessage: {
              ...(message.message?.audioMessage as any),
              ...(payload.message?.audioMessage as any),
            },
          },
        }
      }

      if (payload.status && message.status !== payload.status) {
        return {
          ...message,
          status: payload.status,
          ...(payload as any),
        }
      }

      return message
    })
  )
}
