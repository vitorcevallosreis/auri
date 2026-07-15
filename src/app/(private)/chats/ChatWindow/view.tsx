import React from "react"
import ChatMessages from "./components/ChatMessages"
import ChatSendMessage from "./components/ChatSendMessage"
import ChatEmpty from "./components/ChatEmpty"
import useChatWindowModel from "./model"
import ChatHeader from "./components/ChatHeader"

export default function ChatWindowView({
  selected_chat_windows,
  isLoading,
}: ReturnType<typeof useChatWindowModel>) {
  if (!selected_chat_windows) return <ChatEmpty />

  return (
    <div className="w-full h-full min-h-0 flex flex-col overflow-hidden relative">
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white bg-opacity-85 z-50">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-sm font-medium text-gray-700">
            Carregando mensagens...
          </p>
        </div>
      )}

      <ChatHeader />
      <ChatMessages />
      <ChatSendMessage />
    </div>
  )
}
