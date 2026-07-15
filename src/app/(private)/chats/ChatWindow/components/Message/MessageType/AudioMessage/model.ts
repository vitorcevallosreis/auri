import { MessageSchemaTyped } from "@/contexts/Messages/schemas"

export interface IAudioMessageModel {
  w_full: boolean
  message: MessageSchemaTyped
}

const useAudioMessageModel = (
  w_full: boolean,
  message: MessageSchemaTyped
): IAudioMessageModel => {
  return { w_full, message }
}

export default useAudioMessageModel
