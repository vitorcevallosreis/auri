import React from "react";
import useChatListModel from "./model";
import ChatListView from "./view";

export default function ChatList({}) {
  const chatListModel = useChatListModel();

  return <ChatListView {...chatListModel} />;
}
