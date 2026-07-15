import React from "react"
import useCreateProductModel from "./model"
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Select,
  SelectItem,
  Switch,
  Textarea,
} from "@nextui-org/react"

export default function CreateProductView({
  is_open,
  set_is_open,
  onSubmit,
  handleSubmit,
  register,
  errors,
  categories,
  watch,
  setValue,
}: ReturnType<typeof useCreateProductModel>) {
  return (
    <>
      <Button onPress={() => set_is_open(true)}>Cadastrar Produto</Button>
      <Modal
        isOpen={is_open}
        onOpenChange={() => set_is_open(false)}
        placement="center"
        size="3xl"
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <ModalContent>
            {(onClose) => (
              <>
                <ModalHeader className="flex flex-col gap-1">
                  Cadastrar Produto
                </ModalHeader>
                <ModalBody>
                  <Select
                    label="Selecione a Categoria"
                    placeholder="Selecione a Categoria"
                    {...register("category_id")}
                    errorMessage={errors?.category_id?.message}
                    isInvalid={errors.category_id ? true : false}
                  >
                    {categories.map((category) => (
                      <SelectItem key={category.id}>{category.name}</SelectItem>
                    ))}
                  </Select>

                  <Input
                    label="Nome do Produto"
                    type="text"
                    {...register("name")}
                    errorMessage={errors?.name?.message}
                    isInvalid={errors.name ? true : false}
                  />

                  <Input
                    label="Preço do Produto"
                    type="number"
                    {...register("price")}
                    errorMessage={errors?.price?.message}
                    isInvalid={errors.price ? true : false}
                  />

                  <Textarea
                    label="Descrição do Produto"
                    type="text"
                    {...register("description")}
                    errorMessage={errors?.description?.message}
                    isInvalid={errors.description ? true : false}
                    maxRows={4}
                    rows={4}
                  />

                  <Switch
                    isDisabled={false}
                    onValueChange={(value) => setValue("available", value)}
                    defaultSelected
                    aria-label="Disponibilidade do Produto"
                  >
                    Produto {watch("available") ? "Disponível" : "Indisponível"}
                  </Switch>
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
