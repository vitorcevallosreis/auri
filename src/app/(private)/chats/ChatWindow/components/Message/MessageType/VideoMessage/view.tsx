import React from "react"
import useVideoMessageModel from "./model"
import MessageMetadata from "../MessageMetadata/MessageMetadata"

export default function VideoMessageView({
  w_full,
  message,
}: ReturnType<typeof useVideoMessageModel>) {
  return (
    <div
      className={`${
        w_full ? "w-full h-auto" : "max-w-[400px] max-h-[280px]"
      } h-auto relative inline-block`}
    >
      <video
        src={message.message.videoMessage?.url}
        className="w-full h-auto rounded-md"
        controls
      />

      <div className="absolute top-3 right-2 rounded text-xs z-10">
        <MessageMetadata message={message} bgColor="text-white" />
      </div>
    </div>
  )
}
