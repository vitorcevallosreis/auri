import { z } from "zod"
import { messageContentSchema } from "../Messages/schemas"

export const ChatSchema = z.object({
  id: z.string(),
  labels: z.array(z.string()).nullable(),
  muted: z.boolean().default(false),
  archived: z.boolean().default(false),
  bot_running: z.boolean().default(false),
  chat_pause: z.boolean().default(false),
  updated_at: z.string().nullable(),
  last_message: messageContentSchema,
  channel_name: z.string().nullable().optional(),
  contact: z.object({
    id: z.string(),
    name: z.string(),
    number: z.string(),
    remote_jid: z.string(),
    checked: z.boolean().default(false),
    company_id: z.string(),
    avatar_url: z.string().nullable().optional(),
  }),
})

export const ChatsSchema = z.array(ChatSchema)

export type ChatsSchemaTyped = z.infer<typeof ChatsSchema>

export type ChatSchemaTyped = z.infer<typeof ChatSchema>
