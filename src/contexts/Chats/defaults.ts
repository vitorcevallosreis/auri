import { Defaults } from "./interfaces"

export const Default: Defaults = {
  isLoading: false,
  chats: [],
  chat: {
    id: "",
    labels: [],
    muted: false,
    archived: false,
    bot_running: false,
    updated_at: "",
    last_message: {},
    contact: {
      id: "",
      name: "",
      number: "",
      remote_jid: "",
      checked: false,
      company_id: "",
      avatar_url: "",
    },
  },
}
