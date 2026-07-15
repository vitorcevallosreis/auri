import { Defaults } from "./interfaces"

export const Default: Defaults = {
  isLoading: false,
  messages: [],
  message: {
    id: "",
    chat_id: "",
    message_id: "",
    instance_id: "",
    session_id: "",
    key: {
      fromMe: false,
      id: "",
      remoteJid: "",
    },
    message_type: "conversation",
    message: {},
    context_info: {},
    message_timestamp: 0,
    from_me: false,
    status: "PENDING",
    created_at: "",
    updated_at: "",
  },
  message_info: null,
}
