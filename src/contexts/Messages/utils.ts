import { EnumMessageTyped } from "./schemas"

export const get_midia_type = (midia: File) => {
  const file_type = midia.type.split("/")[0]
  const mime_type = midia.type

  switch (file_type) {
    case "audio":
      if (
        ["audio/mpeg", "audio/mp3", "audio/ogg", "audio/wav"].includes(
          mime_type
        )
      ) {
        return EnumMessageTyped.AUDIO_MESSAGE
      }
    case "image":
      if (["image/png", "image/jpeg", "image/jpg"].includes(mime_type)) {
        return EnumMessageTyped.IMAGE_MESSAGE
      }
    case "video":
      if (["video/mp4", "video/webm", "video/ogg"].includes(mime_type)) {
        return EnumMessageTyped.VIDEO_MESSAGE
      }
    default:
      return EnumMessageTyped.DOCUMENT_MESSAGE
  }
}
