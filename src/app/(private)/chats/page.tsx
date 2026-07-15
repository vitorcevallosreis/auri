"use client"

import useChatsModel from "./model"
import ChatsView from "./view"

export default function Chats() {
  const chatsModel = useChatsModel()

  return <ChatsView {...chatsModel} />
}
