import React from "react"
import useConversationMessageModel from "./model"
import MessageMetadata from "../MessageMetadata/MessageMetadata"

export default function ConversationMessageView({
  w_full,
  message,
}: ReturnType<typeof useConversationMessageModel>) {
  // Verificar qual formato de mensagem está disponível
  const messageText =
    message.message?.extendedTextMessage?.text || message.message?.conversation

  return (
    <div
      className={`${
        w_full ? "w-full" : "max-w-sm"
      } ${
        message.from_me ? "bg-[#efffe5]" : "bg-white"
      } text-gray-800 border border-gray-200 rounded-md p-2 shadow-sm`}
    >
      <div className="text-md break-words">{messageText}</div>

      <MessageMetadata message={message} />
    </div>
  )
}
