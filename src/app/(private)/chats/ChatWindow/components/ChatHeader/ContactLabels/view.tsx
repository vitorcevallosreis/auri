import React from "react"
import useContactLabelsModel from "./model"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerFooter,
  Button,
  Input,
} from "@nextui-org/react"
import { Plus, Trash2 } from "lucide-react"

export default function ContactLabelsView({
  is_open,
  set_is_open,
  labels,
  handleAddLabel,
  handleChangeLabel,
  handleRemoveLabel,
  handleSave,
}: ReturnType<typeof useContactLabelsModel>) {
  return (
    <Drawer
      isOpen={is_open}
      onOpenChange={() => set_is_open(!is_open)}
      backdrop="blur"
      size="2xl"
    >
      <DrawerContent>
        <DrawerHeader className="flex flex-col gap-1">
          Etiquetas do Contato
        </DrawerHeader>
        <DrawerBody>
          <div className="grid grid-rows gap-3">
            {labels.map((label, index) => (
              <div
                key={index}
                className="w-full flex justify-between items-center gap-3"
              >
                <div className="w-[90%]">
                  <Input
                    label="Nome da Etiqueta"
                    value={label}
                    onChange={(e) => handleChangeLabel(index, e.target.value)}
                    type="text"
                  />
                </div>
                <div className="w-[10%]">
                  <Button
                    color="danger"
                    isIconOnly
                    onPress={() => handleRemoveLabel(index)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            ))}

            <div className="w-full flex justify-between items-center gap-3">
              <div className="w-[90%]">
                <Button color="primary" onPress={handleAddLabel} isIconOnly>
                  <Plus />
                </Button>
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
            Cancelar
          </Button>
          <Button color="primary" onPress={handleSave}>
            Salvar
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
