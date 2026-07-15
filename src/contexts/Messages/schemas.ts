import { z } from "zod"

export enum EnumMessageTyped {
  IMAGE_MESSAGE = "imageMessage",
  VIDEO_MESSAGE = "videoMessage",
  AUDIO_MESSAGE = "audioMessage",
  DOCUMENT_MESSAGE = "documentMessage",
  CONVERSATION = "conversation",
  LOCATION_MESSAGE = "locationMessage",
  CONTACT_MESSAGE = "contactMessage",
  STICKER_MESSAGE = "stickerMessage",
  TEMPLATE_MESSAGE = "templateMessage",
  EXTENDED_TEXT_MESSAGE = "extendedTextMessage",
}

export const messageKeySchema = z.object({
  fromMe: z.boolean().optional(),
  id: z.string().optional(),
  remoteJid: z.string().optional(),
})

const MessageTypeEnum = z.enum([
  "conversation",
  "imageMessage",
  "videoMessage",
  "audioMessage",
  "documentMessage",
  "locationMessage",
  "contactMessage",
  "stickerMessage",
  "templateMessage",
  "extendedTextMessage",
])

export type EnumMessageType = z.infer<typeof MessageTypeEnum>

export const MessageStatusSchema = z.union([
  z.literal("ERROR"),
  z.literal("PENDING"),
  z.literal("SERVER_ACK"),
  z.literal("DELIVERY_ACK"),
  z.literal("READ"),
  z.literal("DELETED"),
  z.literal("PLAYED"),
])

export const EnumSourceSchema = z.enum([
  "unknown",
  "ios",
  "android",
  "desktop",
  "web",
])

export type EnumSource = z.infer<typeof EnumSourceSchema>

export const EnumMessageStatusSchema = z.enum([
  "ERROR",
  "PENDING",
  "SERVER_ACK",
  "DELIVERY_ACK",
  "READ",
  "DELETED",
  "PLAYED",
])

export type EnumMessageStatus = z.infer<typeof EnumMessageStatusSchema>

export type MessageType = z.infer<typeof MessageTypeEnum>

export const messageAudioSchema = z.object({
  ptt: z.boolean().optional(),
  url: z.string().optional(),
  seconds: z.number().optional(),
  mediaKey: z.string().optional(),
  mimetype: z.string().optional(),
  waveform: z.string().optional(),
  directPath: z.string().optional(),
  fileLength: z.string().optional(),
  fileSha256: z.string().optional(),
  fileEncSha256: z.string().optional(),
  mediaKeyTimestamp: z.string().optional(),
})

export const ContextMessageSchema = z.object({
  expiration: z.number(),
})

export const messageVideoSchema = z.object({
  url: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  seconds: z.number().optional(),
  mediaKey: z.string().optional(),
  mimetype: z.string().optional(),
  directPath: z.string().optional(),
  fileLength: z.string().optional(),
  fileSha256: z.string().optional(),
  fileEncSha256: z.string().optional(),
  jpegThumbnail: z.string().optional(),
  streamingSidecar: z.string().optional(),
  mediaKeyTimestamp: z.string().optional(),
  messageContextInfo: z
    .object({
      messageSecret: z.string().optional(),
    })
    .optional(),
})

export const messageLocationSchema = z.object({
  degreesLatitude: z.number(),
  degreesLongitude: z.number(),
})

export enum EnumMessageDocumentMimeType {
  PDF = "application/pdf",
}

export const MessageDocumentMimeTypeSchema = z.nativeEnum(
  EnumMessageDocumentMimeType
)

export const messageDocumentSchema = z.object({
  url: z.string().optional(),
  fileName: z.string().optional(),
  mediaKey: z.string().optional(),
  mimetype: z.string().optional(),
  // pageCount: z.number(),
  directPath: z.string().optional(),
  fileLength: z.string().optional(),
  fileSha256: z.string().optional(),
  fileEncSha256: z.string().optional(),
  mediaKeyTimestamp: z.string().optional(),
})

export const messageImageSchema = z.object({
  url: z.string().optional(),
  caption: z.string().optional(),
  mediaKey: z.string().optional(),
  mimetype: z.string().optional(),
  directPath: z.string().optional(),
  fileLength: z.string().optional(),
  fileSha256: z.string().optional(),
  contextInfo: z.union([z.object({ expiration: z.number().optional() }), z.object({})]).optional(),
  fileEncSha256: z.string().optional(),
  mediaKeyTimestamp: z.string().optional(),
})

export const messageStickerSchema = z.object({
  url: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  isAvatar: z.boolean().optional(),
  isLottie: z.boolean().optional(),
  mediaKey: z.string().optional(),
  mimetype: z.string().optional(),
  directPath: z.string().optional(),
  fileLength: z.string().optional(),
  fileSha256: z.string().optional(),
  isAnimated: z.boolean().optional(),
  isAiSticker: z.boolean().optional(),
  fileEncSha256: z.string().optional(),
  stickerSentTs: z.string().optional(),
  mediaKeyTimestamp: z.string().optional(),
})

export const messageContactSchema = z.object({
  vcard: z.string(),
  displayName: z.string(),
})

export const messageTemplateHydratedButtonSchema = z.object({
  index: z.number(),
  urlButton: z.object({
    url: z.string(),
    displayText: z.string(),
  }),
})

export const messageTemplateSchema = z.object({
  hydratedTemplate: z.object({
    videoMessage: z.object({
      width: z.number(),
      height: z.number(),
      caption: z.string(),
      seconds: z.number(),
      mediaKey: z.string(),
      mimetype: z.string(),
      staticUrl: z.string(),
      fileLength: z.string(),
      fileSha256: z.string(),
      fileEncSha256: z.string(),
    }),
    hydratedButtons: z.array(messageTemplateHydratedButtonSchema),
    hydratedContentText: z.string(),
  }),
  hydratedFourRowTemplate: z.object({
    videoMessage: z.object({
      width: z.number(),
      height: z.number(),
      caption: z.string(),
      seconds: z.number(),
      mediaKey: z.string(),
      mimetype: z.string(),
      staticUrl: z.string(),
      fileLength: z.string(),
      fileSha256: z.string(),
      fileEncSha256: z.string(),
    }),
    hydratedButtons: z.array(messageTemplateHydratedButtonSchema),
    hydratedContentText: z.string(),
  }),
})

export const messageContentSchema = z.object({
  conversation: z.string().optional(),
  extendedTextMessage: z.object({ text: z.string() }).optional(),
  audioMessage: messageAudioSchema.optional(),
  videoMessage: messageVideoSchema.optional(),
  locationMessage: messageLocationSchema.optional(),
  documentMessage: messageDocumentSchema.optional(),
  imageMessage: messageImageSchema.optional(),
  stickerMessage: messageStickerSchema.optional(),
  contactMessage: messageContactSchema.optional(),
  templateMessage: messageTemplateSchema.optional(),
})

export const MessageSchema = z.object({
  id: z.string(),
  chat_id: z.string(),
  message_id: z.string().optional().nullable(),
  key: messageKeySchema.optional().nullable().default({}),
  message_type: MessageTypeEnum,
  message: messageContentSchema.optional().default({}),
  context_info: ContextMessageSchema.nullable().optional(),
  message_timestamp: z.number().optional().nullable(),
  instance_id: z.string().optional().nullable(),
  session_id: z.string().nullable().optional(),
  from_me: z.boolean(),
  status: MessageStatusSchema,
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
})

export const MessagesSchema = z.array(MessageSchema)

export type MessagesSchemaTyped = z.infer<typeof MessagesSchema>
export type MessageSchemaTyped = z.infer<typeof MessageSchema>
