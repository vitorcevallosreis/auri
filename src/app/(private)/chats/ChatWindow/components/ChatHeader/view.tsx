import React, { useContext } from "react"
import useChatHeaderModel from "./model"
import ContactImage from "../../../components/ContactImage"
import MessageInfoDrawer from "../Drawers/MessageInfoDrawer"
import { Tags, Menu, CircleUserRound, Trash2, Pause, Play, Bot } from "lucide-react"
import { getChannelColor } from "@/utils/channelColors"
import { ChatsContext } from "@/contexts/Chats"
import { Tooltip } from "@nextui-org/react"
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownSection,
  DropdownItem,
  Button,
  cn,
} from "@nextui-org/react"
import ContactInfo from "./ContactInfo"
import ContactLabels from "./ContactLabels"

export default function ChatHeaderView({
  chat,
  is_open_contact_info,
  set_is_open_contact_info,
  is_open_contact_labels,
  set_is_open_contact_labels,
}: ReturnType<typeof useChatHeaderModel>) {
  const { toggleChatPause } = useContext(ChatsContext)
  const iconClasses =
    "text-xl text-default-500 pointer-events-none flex-shrink-0"

  return (
    <div className="flex w-full gap-3 bg-card border-b border-border p-2">
      <ContactImage
        avatar_url={chat?.contact?.avatar_url ?? ""}
        name={chat?.contact?.name}
      />

      <div className="w-full flex justify-between items-center">
        <div className="flex-1">
          <p className="font-medium text-foreground">
            {chat.contact?.name || chat.contact?.number}
          </p>

          <div className="text-sm text-muted-foreground flex items-center gap-2">
            {chat.contact?.number}
            {chat.channel_name && (
              <span 
                className="text-xs text-white px-1.5 py-0.5 rounded-md"
                style={{ backgroundColor: getChannelColor(chat.channel_name) }}
              >
                {chat.channel_name.split('_')[0]}
              </span>
            )}
          </div>
        </div>
        
        {/* Botão de controle do bot - visível no header */}
        <div className="flex items-center mr-2">
          <Tooltip
            content={chat.chat_pause ? "Bot pausado - Clique para reativar" : "Bot ativo - Clique para pausar"}
            placement="bottom"
          >
            <button
              onClick={() => chat.id && toggleChatPause(chat.id)}
              className={`flex items-center justify-center p-2 rounded-full transition-colors ${chat.chat_pause 
                ? "bg-muted hover:bg-gray-300 text-foreground" 
                : "bg-green-100 hover:bg-green-200 text-green-700"}`}
              aria-label={chat.chat_pause ? "Reativar bot" : "Pausar bot"}
            >
              {chat.chat_pause ? (
                <Play className="w-5 h-5" />
              ) : (
                <Pause className="w-5 h-5" />
              )}
              <span className="sr-only">{chat.chat_pause ? "Reativar bot" : "Pausar bot"}</span>
            </button>
          </Tooltip>
          
          {/* Indicador de status do bot */}
          <div className={`ml-2 flex items-center ${chat.chat_pause ? "text-muted-foreground" : "text-green-600"}`}>
            <Bot className="w-4 h-4 mr-1" />
            <span className="text-xs font-medium">
              {chat.chat_pause ? "Pausado" : "Ativo"}
            </span>
          </div>
        </div>

        <Dropdown>
          <DropdownTrigger>
            <Button variant="flat" isIconOnly>
              <Menu />
            </Button>
          </DropdownTrigger>
          <DropdownMenu variant="faded">
            <DropdownSection showDivider title="Ações">
              <DropdownItem
                key="new"
                description="Veja todas as informações deste Contato."
                startContent={<CircleUserRound className={iconClasses} />}
                onPress={() => set_is_open_contact_info(true)}
              >
                Informações do Contato
              </DropdownItem>

              <DropdownItem
                key="copy"
                description="Adicione ou Remova Etiquetas deste Contato."
                startContent={<Tags className={iconClasses} />}
                onPress={() => set_is_open_contact_labels(true)}
              >
                Eiquetas
              </DropdownItem>
              
              {/* Removido o item do dropdown já que agora temos o botão visível no header */}
            </DropdownSection>
            <DropdownSection title="Atenção!">
              <DropdownItem
                key="delete"
                className="text-danger"
                color="danger"
                description="Excluirá o Chat e todas as mensagens dele!"
                startContent={
                  <Trash2 className={cn(iconClasses, "text-danger")} />
                }
              >
                Apagar Conversa
              </DropdownItem>
            </DropdownSection>
          </DropdownMenu>
        </Dropdown>

        <ContactInfo
          is_open={is_open_contact_info}
          set_is_open={set_is_open_contact_info}
        />

        <ContactLabels
          is_open={is_open_contact_labels}
          set_is_open={set_is_open_contact_labels}
        />

        <MessageInfoDrawer />
      </div>
    </div>
  )
}
