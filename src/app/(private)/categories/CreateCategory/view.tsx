import React from "react"
import useCreateCategoryModel from "./model"
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
} from "@nextui-org/react"

export default function CreateCategoryView({
  is_open,
  set_is_open,
  onSubmit,
  handleSubmit,
  register,
  errors,
}: ReturnType<typeof useCreateCategoryModel>) {
  return (
    <>
      <Button onPress={() => set_is_open(true)}>Cadastrar Categoria</Button>
      <Modal isOpen={is_open} onOpenChange={() => set_is_open(false)}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <ModalContent>
            {(onClose) => (
              <>
                <ModalHeader className="flex flex-col gap-1">
                  Cadastrar Categoria
                </ModalHeader>
                <ModalBody>
                  <Input
                    label="Categoria"
                    type="text"
                    {...register("name")}
                    errorMessage={errors?.name?.message}
                    isInvalid={errors.name ? true : false}
                  />
                </ModalBody>
                <ModalFooter>
                  <Button color="danger" variant="light" onPress={onClose}>
                    Fechar
                  </Button>
                  <Button color="primary" type="submit">
                    Cadastrar
                  </Button>
                </ModalFooter>
              </>
            )}
          </ModalContent>
        </form>
      </Modal>
    </>
  )
}
