import React from "react"
import usePreviewAssistantModel from "./model"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerFooter,
  Avatar,
} from "@nextui-org/react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

export default function PreviewAssistantView({
  isOpen,
  onOpen,
  onOpenChange,
  assistant,
}: ReturnType<typeof usePreviewAssistantModel>) {
  console.log(assistant)
  return (
    <React.Fragment>
      <Button variant="outline" onClick={onOpen}>
        Preview
      </Button>
      <Drawer
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        size="xl"
        radius="none"
      >
        <DrawerContent>
          {(onClose) => (
            <React.Fragment>
              <DrawerHeader className="flex flex-col gap-1 text-foreground">
                Preview Assistente: {assistant?.name}
              </DrawerHeader>
              <DrawerBody>
                <div className="flex justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <Avatar
                      isBordered
                      showFallback
                      radius="full"
                      size="lg"
                      src={assistant?.avatar as string}
                    />
                    <div>
                      <div className="font-medium text-foreground">{assistant?.name}</div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <div>Funcionalidade:</div>
                        <div className="font-semibold text-foreground">
                          {assistant?.purpose
                            ? assistant?.purpose
                            : "Não definida"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="text-muted-foreground">LLM: {assistant?.llm}</div>
                </div>
                <div className="grid grid-rows-3 gap-5">
                  <div>
                    <div className="font-medium text-foreground mb-1">Identidade do Assistente</div>
                    <Textarea
                      defaultValue={assistant?.identity as string}
                      rows={5}
                      readOnly
                    />
                  </div>

                  <div>
                    <div className="font-medium text-foreground mb-1">Descrição do Assistente</div>
                    <Textarea
                      defaultValue={assistant?.description as string}
                      rows={5}
                      readOnly
                    />
                  </div>

                  <div>
                    <div className="font-medium text-foreground mb-1">Objetivo do Assistente</div>
                    <Textarea
                      defaultValue={assistant?.objective as string}
                      rows={5}
                      readOnly
                    />
                  </div>

                  <div>
                    <div className="font-medium text-foreground mb-1">Saudações do Assistente</div>
                    <Textarea
                      defaultValue={assistant?.greetings as string}
                      rows={5}
                      readOnly
                    />
                  </div>
                </div>
              </DrawerBody>
              <DrawerFooter>
                <Button variant="outline" onClick={onClose}>
                  Fechar
                </Button>
              </DrawerFooter>
            </React.Fragment>
          )}
        </DrawerContent>
      </Drawer>
    </React.Fragment>
  )
}
