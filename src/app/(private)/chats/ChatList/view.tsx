import React from "react"
import useChatListModel from "./model"
import ContactImage from "../components/ContactImage"
import { motion } from "framer-motion"
import moment from "moment"
import { Archive, ArchiveRestore, Bell, BellOff } from "lucide-react"
import { getChannelColor } from "@/utils/channelColors"

import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  Listbox,
  ListboxItem,
} from "@nextui-org/react"

export default function ChatListView({
  chats,
  selected_chat_windows,
  set_selected_chat_windows,
  handleMuteChat,
  handleUnmuteChat,
  selected_chat_context,
  contextMenuRef,
  handle_context_menu,
}: ReturnType<typeof useChatListModel>) {
  return (
    // @ts-expect-error ref error
    <div ref={contextMenuRef} style={{ borderBottom: "1px solid #d1d5db" }}>
      <ul className="divide-y divide-gray-200 overflow-auto scrollbar-hide">
        {chats.map((chat, index: number) => (
          <motion.li
            key={index}
            className={`hover:bg-gray-100 cursor-pointer ${
              chat.id === selected_chat_windows ? "bg-gray-100" : ""
            }`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.8 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
          >
            <Popover
              showArrow={true}
              placement="right"
              isOpen={selected_chat_context === chat.id}
              radius="sm"
              size="lg"
              aria-label="list"
            >
              <PopoverTrigger>
                <div
                  className="flex items-center"
                  onClick={() => {
                    selected_chat_windows === chat.id
                      ? set_selected_chat_windows("")
                      : set_selected_chat_windows(chat.id)
                  }}
                  onContextMenu={(e) => handle_context_menu(e, chat.id)}
                >
                  <div className="flex w-full p-2 gap-3 items-center">
                    <div className="size-14 flex items-center justify-center">
                      <ContactImage
                        avatar_url={chat.contact.avatar_url as string}
                        name={chat.contact.name}
                      />
                    </div>

                    <div className="flex-1 flex items-center">
                      <div className="flex flex-col justify-center flex-1">
                        <div className="font-bold text-gray-900 flex items-center gap-2">
                          {chat.contact.name}
                          {chat.channel_name && (
                            <span 
                              className="text-xs text-white px-1.5 py-0.5 rounded-md"
                              style={{ backgroundColor: getChannelColor(chat.channel_name) }}
                            >
                              {chat.channel_name.split('_')[0]}
                            </span>
                          )}
                        </div>
                        <div
                          className="text-gray-500 truncate"
                          style={{
                            fontSize: 13,
                          }}
                        >
                          {chat?.last_message?.conversation}
                        </div>
                      </div>

                      <div className="flex flex-row items-center gap-2 text-sm text-gray-400">
                        <div>
                          {moment().diff(moment(chat.updated_at), 'hours') >= 24 
                            ? moment(chat.updated_at).format("DD/MM/YYYY") 
                            : moment(chat.updated_at).format("HH:mm")}
                        </div>
                        {chat.muted && <BellOff color="#9ca3af" size={16} />}
                      </div>
                    </div>
                  </div>
                </div>
              </PopoverTrigger>
              <PopoverContent>
                <Listbox variant="flat">
                  <ListboxItem
                    key="mute_unmute"
                    startContent={
                      chat.muted ? (
                        <Bell color="#9ca3af" size={18} />
                      ) : (
                        <BellOff color="#9ca3af" size={18} />
                      )
                    }
                    onPress={() => {
                      chat.muted
                        ? handleMuteChat(chat.id)
                        : handleUnmuteChat(chat.id)
                    }}
                    description="Ative ou Desative as notificações do Chat!"
                  >
                    {chat.muted ? "Habilitar Notificações" : "Silenciar Chat"}
                  </ListboxItem>

                  <ListboxItem
                    key="copy"
                    startContent={
                      chat.archived ? (
                        <ArchiveRestore color="#9ca3af" size={18} />
                      ) : (
                        <Archive color="#9ca3af" size={18} />
                      )
                    }
                  >
                    {chat.archived
                      ? "Desarquivar Conversa"
                      : "Arquivar Conversa"}
                  </ListboxItem>

                  <ListboxItem
                    key="delete"
                    className="text-danger"
                    color="danger"
                    isReadOnly={chat.bot_running}
                    isDisabled={chat.bot_running}
                    description={
                      chat.bot_running
                        ? "Você só pode excluir se o Assistente não tiver em Funcionamento"
                        : "Exclua o Chat da sua Lista!"
                    }
                  >
                    Excluir Chat
                  </ListboxItem>
                </Listbox>
              </PopoverContent>
            </Popover>
          </motion.li>
        ))}
      </ul>
    </div>
  )
}
