import useAudioMessageModel from "./model"
import AudioMessageView from "./view"
import { MessageSchemaTyped } from "@/contexts/Messages/schemas"

interface AudioMessageProps {
  w_full: boolean
  message: MessageSchemaTyped
}

export default function AudioMessage({ w_full, message }: AudioMessageProps) {
  const AudioMessageModel = useAudioMessageModel(w_full, message)

  return <AudioMessageView {...AudioMessageModel} />
}
