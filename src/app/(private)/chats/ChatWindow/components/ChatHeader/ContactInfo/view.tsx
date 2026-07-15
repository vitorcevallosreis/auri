import React from "react"
import useContactInfoModel from "./model"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerFooter,
  Button,
} from "@nextui-org/react"
import ContactImage from "@/app/(private)/chats/components/ContactImage"

export default function ContactInfoView({
  chat,
  is_open,
  set_is_open,
}: ReturnType<typeof useContactInfoModel>) {
  return (
    <Drawer
      isOpen={is_open}
      onOpenChange={() => set_is_open(!is_open)}
      backdrop="blur"
      size="2xl"
    >
      <DrawerContent>
        <DrawerHeader className="flex flex-col gap-1">
          Informações do Contato
        </DrawerHeader>
        <DrawerBody>
          <div className="flex justify-center">
            <div className="grid grid-rows gap-4">
              <div className="flex justify-center">
                <ContactImage
                  avatar_url={chat?.contact?.avatar_url as string}
                  name={chat?.contact?.name}
                  width={168}
                  height={168}
                />
              </div>

              <div className="text-center text-2xl">{chat?.contact?.name}</div>
              <div className="text-center text-gray-400">
                {chat?.contact?.number}
              </div>
            </div>
          </div>
        </DrawerBody>
        <DrawerFooter>
          <Button
            color="danger"
            variant="light"
            onPress={() => set_is_open(false)}
          >
            Fechar
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
