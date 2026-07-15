import { ChatsContext } from "@/contexts/Chats"
import { Chat } from "@/contexts/Chats/interfaces"
import { Dispatch, SetStateAction, useContext } from "react"

export interface IContactInfoModel {
  chat: Chat
  is_open: boolean
  set_is_open: Dispatch<SetStateAction<boolean>>
}

const useContactInfoModel = (
  is_open: boolean,
  set_is_open: Dispatch<SetStateAction<boolean>>
): IContactInfoModel => {
  const { chat } = useContext(ChatsContext)

  return { chat, is_open, set_is_open }
}

export default useContactInfoModel
