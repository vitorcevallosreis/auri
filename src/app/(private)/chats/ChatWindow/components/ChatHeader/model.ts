import { ChatsContext } from "@/contexts/Chats"
import { Chat } from "@/contexts/Chats/interfaces"
import { Dispatch, SetStateAction, useContext, useState } from "react"

export interface IChatHeaderModel {
  chat: Chat
  is_open_contact_info: boolean
  set_is_open_contact_info: Dispatch<SetStateAction<boolean>>

  is_open_contact_labels: boolean
  set_is_open_contact_labels: Dispatch<SetStateAction<boolean>>
}

const useChatHeaderModel = (): IChatHeaderModel => {
  const { chat } = useContext(ChatsContext)
  const [is_open_contact_info, set_is_open_contact_info] = useState(false)
  const [is_open_contact_labels, set_is_open_contact_labels] = useState(false)

  return {
    chat,
    is_open_contact_info,
    set_is_open_contact_info,
    is_open_contact_labels,
    set_is_open_contact_labels,
  }
}

export default useChatHeaderModel
