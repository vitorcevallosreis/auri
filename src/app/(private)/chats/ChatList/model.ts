import { ChatsContext } from "@/contexts/Chats"
import { Chat } from "@/contexts/Chats/interfaces"
import {
  Dispatch,
  SetStateAction,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"

export interface IChatListModel {
  chats: Chat[]
  selected_chat_windows: string | null
  set_selected_chat_windows: Dispatch<SetStateAction<string | null>>
  handleMuteChat: (chat_id: string) => Promise<void>
  handleUnmuteChat: (chat_id: string) => Promise<void>
  selected_chat_context: string | null
  contextMenuRef: HTMLDivElement | undefined | null
  handle_context_menu: (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
    chat_id: string
  ) => void
}

const useChatListModel = (): IChatListModel => {
  const {
    chats,
    selected_chat_windows,
    set_selected_chat_windows,
    muteAndUnmuteChat,
  } = useContext(ChatsContext)

  const [selected_chat_context, set_selected_chat_context] = useState<
    string | null
  >(null)

  const handleMuteChat = async (chat_id: string) =>
    await muteAndUnmuteChat(chat_id, false)

  const handleUnmuteChat = async (chat_id: string) =>
    await muteAndUnmuteChat(chat_id, true)

  const handle_context_menu = (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
    chat_id: string
  ) => {
    e.preventDefault()

    if (chat_id !== selected_chat_context) {
      set_selected_chat_context(chat_id)
      return
    }

    set_selected_chat_context(null)
  }

  const contextMenuRef = useRef<HTMLDivElement | undefined | null>(null)

  useEffect(() => {
    // quando abre o menu com o botão direito, ao clicar em qualquer outra parte da tela
    // o menu é fechado
    const handleClickOutside = (event: MouseEvent) => {
      if (
        selected_chat_context &&
        contextMenuRef.current &&
        !contextMenuRef.current.contains(event.target as Node)
      ) {
        set_selected_chat_context(null)
      }
    }

    document.addEventListener("click", handleClickOutside)
    return () => document.removeEventListener("click", handleClickOutside)
  }, [selected_chat_context])

  return {
    chats,
    selected_chat_windows,
    set_selected_chat_windows,
    handleMuteChat,
    handleUnmuteChat,
    selected_chat_context,
    // @ts-expect-error ref error
    contextMenuRef,
    handle_context_menu,
  }
}

export default useChatListModel
