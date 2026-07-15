import {
  MessageSchemaTyped,
  EnumMessageTyped,
} from "@/contexts/Messages/schemas"
import { MessagesContext } from "@/contexts/Messages"
import { cn, Listbox, ListboxItem } from "@nextui-org/react"
import { CheckCheck, Reply, Trash2, CopyCheck, Download } from "lucide-react"
import { Dispatch, SetStateAction, useContext } from "react"
import { toast } from "sonner"
import React from "react"
import classNames from "classnames"
import { twMerge } from "tailwind-merge"
import { Popover, PopoverTrigger, PopoverContent } from "@nextui-org/react"
import { ChatsContext } from "@/contexts/Chats"

export default function MessageActions({
  w_full,
  message,
  children,
  openMessageId,
  setOpenMessageId,
  handleContextMenu,
}: {
  children: React.ReactNode
  openMessageId: string | null
  setOpenMessageId: Dispatch<SetStateAction<string | null>>
  handleContextMenu: (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
    messageId: string
  ) => void
  w_full: boolean
  message: MessageSchemaTyped
}) {
  const messageClass = classNames({
    "w-full": w_full,
    "ms-auto text-end": message.from_me,
  })

  const { chat } = useContext(ChatsContext)
  const { set_message_info, set_message } = useContext(MessagesContext)
  const iconClasses =
    "text-xl text-default-500 pointer-events-none flex-shrink-0"

  const handle_context_menu = (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
    messageId: string
  ) => {
    e.preventDefault()

    handleContextMenu(e, messageId)
  }

  const handleDownload = async (message: MessageSchemaTyped) => {
    if (!message.message.imageMessage) return

    const response = await fetch(message.message.imageMessage.url ?? "")
    const blob = await response.blob()
    const blobUrl = URL.createObjectURL(blob)

    const a = document.createElement("a")
    a.href = blobUrl
    const downloadName = message.message.imageMessage.caption || 'imagem'
    a.download = downloadName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)

    URL.revokeObjectURL(blobUrl)
  }

  return (
    <div
      className={twMerge("cursor-pointer transition-opacity duration-200 hover:opacity-95", messageClass)}
      onContextMenu={(e) => handle_context_menu(e, message.id)}
      onClick={() => {
        // Toggle abrir/fechar ao clicar com o botão esquerdo
        if (openMessageId === message.id) {
          setOpenMessageId(null)
        } else {
          setOpenMessageId(message.id)
        }
      }}
    >
      <Popover
        showArrow={true}
        placement={message.from_me ? "left" : "top-start"}
        isOpen={openMessageId === message.id}
        radius="sm"
        size="lg"
      >
        <PopoverTrigger>
          <div>{children}</div>
        </PopoverTrigger>
        <PopoverContent>
          <Listbox variant="flat">
            {message.from_me ? (
              <ListboxItem
                key="new"
                description="Enviada, Entregue ou Lida"
                onPress={() => {
                  set_message_info(message.id)
                  set_message(message)
                  setOpenMessageId(null)
                }}
                startContent={
                  <CheckCheck width={20} height={20} color="#bababa" />
                }
              >
                Dados da Mensagem
              </ListboxItem>
            ) : (
              <React.Fragment></React.Fragment>
            )}

            <ListboxItem
              key="reply"
              description="Responda essa mensagem"
              startContent={<Reply width={20} height={20} color="#bababa" />}
              showDivider
              isReadOnly={chat.bot_running}
              isDisabled={chat.bot_running}
            >
              Responder
            </ListboxItem>

            {message.message_type === EnumMessageTyped.IMAGE_MESSAGE ? (
              <ListboxItem
                key="download"
                description="Salve o arquivo"
                onPress={() => handleDownload(message)}
                startContent={
                  <Download width={20} height={20} color="#bababa" />
                }
              >
                Baixar Imagem
              </ListboxItem>
            ) : (
              <React.Fragment></React.Fragment>
            )}

            {message.message_type === EnumMessageTyped.CONVERSATION ? (
              <ListboxItem
                key="copy"
                description="Copie o texto da mensagem"
                startContent={<CopyCheck width={20} height={20} />}
                onPress={() => {
                  toast.success("Mensagem copiada!", {
                    position: "bottom-center",
                    duration: 1000,
                  })

                  if (!message.message.conversation) return

                  navigator.clipboard.writeText(message.message.conversation)
                  setOpenMessageId(null)
                }}
              >
                Copiar Mensagem
              </ListboxItem>
            ) : (
              <React.Fragment></React.Fragment>
            )}

            {message.from_me ? (
              <ListboxItem
                key="delete"
                className="text-danger"
                color="danger"
                description="Apagar Mensagem"
                isReadOnly={chat.bot_running}
                isDisabled={chat.bot_running}
                onPress={() => {
                  toast.success("Apagando mensagem...", {
                    duration: 2000,
                  })
                }}
                startContent={
                  <Trash2
                    className={cn(iconClasses, "text-danger")}
                    width={20}
                    height={20}
                  />
                }
              >
                Apagar Mensagem
              </ListboxItem>
            ) : (
              <React.Fragment></React.Fragment>
            )}
          </Listbox>
        </PopoverContent>
      </Popover>
    </div>
  )
}
