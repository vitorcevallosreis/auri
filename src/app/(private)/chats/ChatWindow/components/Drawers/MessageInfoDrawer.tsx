import { HiddenDrawer } from "@/app/components/HiddenDrawerRoot"
import { useContext } from "react"
import { MessagesContext } from "@/contexts/Messages"
import MessageBubble from "../Message/MessageBubble"
import { Default } from "@/contexts/Messages/defaults"
import { Alert } from "@nextui-org/react"

export default function MessageInfoDrawer() {
  const { message, set_message, message_info, set_message_info } =
    useContext(MessagesContext)

  return (
    <HiddenDrawer.Root
      header_title="Dados da Mensagem"
      isOpen={message_info ? true : false}
      size="2xl"
      triggerButtonCloseProps={{
        title: "Fechar",
        color: "primary",
      }}
      onClose={() => {
        set_message_info(null)
        set_message(Default.message)
      }}
    >
      <div>
        <MessageBubble
          message={message}
          w_full={true}
          actions={false}
          openMessageId={null}
          setOpenMessageId={() => {}}
          handleContextMenu={() => {}}
        />

        <div className="mt-3">
          <Alert
            color="warning"
            title="Atenção"
            description="Alguns contatos podem estar com a Confirmação de Leitura desativada,
        sendo assim não é possivel a Confirmação de Leitura."
          />
        </div>
      </div>
    </HiddenDrawer.Root>
  )
}
