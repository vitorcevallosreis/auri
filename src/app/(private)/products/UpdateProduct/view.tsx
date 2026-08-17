import React from "react"
import useUpdateProductModel from "./model"
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
  Image,
} from "@nextui-org/react"

export default function UpdateProductView({
  is_open,
  set_is_open,
  onSubmit,
  handleSubmit,
  register,
  errors,
  categories,
  watch,
  setValue,
  previewUrl,
  uploading,
  handleFileChange,
  uploadFile,
}: ReturnType<typeof useUpdateProductModel>) {
  return (
    <>
      <Button onPress={() => set_is_open(true)} color="warning">
        Ver/Editar
      </Button>
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
                  Editar
                </ModalHeader>
                <ModalBody>
                  <div className="border border-border shadow-lg p-3 rounded-md grid grid-rows gap-4">
                    {previewUrl && (
                      <div className="mt-4 text-center">
                        <div className="flex justify-center mb-4">
                          <Image
                            alt="Foto do Produto"
                            src={previewUrl}
                            width={300}
                          />
                        </div>

                        <Button
                          onPress={() => uploadFile()}
                          color="primary"
                          isDisabled={uploading}
                        >
                          {uploading ? "Enviando Foto..." : "Enviar Foto"}
                        </Button>
                      </div>
                    )}

                    <Input
                      label="Foto do Produto"
                      type="file"
                      onChange={handleFileChange}
                    />
                  </div>

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
                    isSelected={watch("available")}
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
                    Salvar
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
