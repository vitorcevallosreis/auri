import React from "react"
import classNames from "classnames"
import ConversationMessage from "../MessageType/ConversationMessage"
import useMessageBubbleModel from "./model"
import ImageMessage from "../MessageType/ImageMessage"
import AudioMessage from "../MessageType/AudioMessage"
import DocumentMessage from "../MessageType/DocumentMessage"
import LocationMessage from "../MessageType/LocationMessage"
import StickerMessage from "../MessageType/StickerMessage"
// import TemplateMessage from "../MessageType/TemplateMessage"
import VideoMessage from "../MessageType/VideoMessage"
import MessageActions from "../MessageActions/MessageActions"
import { EnumMessageType, EnumMessageTyped } from "@/contexts/Messages/schemas"

export default function MessageBubbleView({
  openMessageId,
  setOpenMessageId,
  handleContextMenu,
  w_full,
  actions,
  message,
}: ReturnType<typeof useMessageBubbleModel>) {
  const render_message_from_type = (message_type: EnumMessageType) => {
    switch (message_type) {
      case EnumMessageTyped.CONVERSATION:
        return <ConversationMessage message={message} w_full={w_full} />

      case EnumMessageTyped.IMAGE_MESSAGE:
        return <ImageMessage message={message} w_full={w_full} />

      case EnumMessageTyped.VIDEO_MESSAGE:
        return <VideoMessage message={message} w_full={w_full} />

      case EnumMessageTyped.AUDIO_MESSAGE:
        return <AudioMessage message={message} w_full={w_full} />

      case EnumMessageTyped.DOCUMENT_MESSAGE:
        return <DocumentMessage message={message} />

      case EnumMessageTyped.LOCATION_MESSAGE:
        return <LocationMessage message={message} w_full={w_full} />

      case EnumMessageTyped.STICKER_MESSAGE:
        return <StickerMessage message={message} />

      case EnumMessageTyped.EXTENDED_TEXT_MESSAGE:
        return <ConversationMessage message={message} w_full={w_full} />

      // case EnumMessageTyped.TEMPLATE_MESSAGE:
      //   return <TemplateMessage message={message} />

      default:
        return <div>Mensagem não suportada!</div>
    }
  }

  return (
    <MessageActions
      message={message}
      key={message.id}
      w_full={w_full}
      openMessageId={openMessageId}
      setOpenMessageId={setOpenMessageId}
      handleContextMenu={handleContextMenu}
    >
      {render_message_from_type(message.message_type)}
    </MessageActions>
  )
}
