import React from "react"
import useStickerMessageModel from "./model"
import { Image } from "@nextui-org/react"
import MessageMetadata from "../MessageMetadata/MessageMetadata"

export default function StickerMessageView({
  message,
}: ReturnType<typeof useStickerMessageModel>) {
  return (
    <React.Fragment>
      <Image
        alt={message.message.stickerMessage?.url}
        src={message.message.stickerMessage?.url}
        // TODO: Imagem padrão caso url seja inválida!
        // fallbackSrc="https://via.placeholder.com/300x200"
        // TODO: Imagem padrão caso url seja inválida!
        width={message.message.stickerMessage?.width}
        height={message.message.stickerMessage?.height}
        radius="none"
      />

      <MessageMetadata message={message} bgColor="text-gray-400 mt-1" />
    </React.Fragment>
  )
}
