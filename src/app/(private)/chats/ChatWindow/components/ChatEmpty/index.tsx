"use client"

import React from "react"
import useChatEmptyModel from "./model"
import ChatEmptyView from "./view"

export default function ChatEmpty() {
  const chatEmptyModel = useChatEmptyModel()

  return <ChatEmptyView {...chatEmptyModel} />
}
