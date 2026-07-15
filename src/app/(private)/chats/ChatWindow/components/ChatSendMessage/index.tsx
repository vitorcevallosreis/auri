import React from 'react'
import useChatSendMessageModel from './model'
import ChatSendMessageView from './view'

export default function ChatSendMessage() {
  const chatSendMessageModel = useChatSendMessageModel()

  return <ChatSendMessageView {...chatSendMessageModel} />
}
