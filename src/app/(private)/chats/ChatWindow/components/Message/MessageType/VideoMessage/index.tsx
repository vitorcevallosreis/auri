import { Message } from "@/contexts/Chats/interfaces"
import useVideoMessageModel from "./model"
import VideoMessageView from "./view"

interface VideoMessageProps {
  w_full: boolean
  message: Message
}

export default function VideoMessage({ w_full, message }: VideoMessageProps) {
  const VideoMessageModel = useVideoMessageModel(w_full, message)

  return <VideoMessageView {...VideoMessageModel} />
}
