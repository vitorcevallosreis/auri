import React from 'react'
import useChatMessagesModel from './model'
import ChatMessagesView from './view'

export default function ChatMessages() {
  const chatMessagesModel = useChatMessagesModel()

  return <ChatMessagesView {...chatMessagesModel} />
}
