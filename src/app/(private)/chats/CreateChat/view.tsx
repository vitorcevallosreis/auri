import React from "react"
import useCreateChatModel from "./model"
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  useDisclosure,
  Input,
  Select,
  SelectItem,
  Avatar,
  Alert,
  ButtonGroup,
} from "@nextui-org/react"
import { MessageSquareDiff } from "lucide-react"
import { InputMask } from "@react-input/mask"

export default function CreateChatView({
  countries,
  contacts,
  register,
  handleSubmit,
  onSubmit,
  watch,
  clearErrors,
  reset,
  errors,
  handleChange,
  tab,
  set_tab,
  uncheckedContacts,
}: ReturnType<typeof useCreateChatModel>) {
  const { isOpen, onOpen, onOpenChange } = useDisclosure()

  return (
    <React.Fragment>
      <div
        onClick={onOpen}
        className="flex items-center justify-center px-4 py-3 cursor-pointer transition-all duration-200 hover:bg-muted/80 group"
      >
        <span className="text-sm font-medium text-foreground group-hover:text-foreground mr-2">
          Novo Chat
        </span>
        <div className="text-muted-foreground group-hover:text-primary transition-colors duration-200">
          <MessageSquareDiff size={16} />
        </div>
      </div>
      <Modal
        isOpen={isOpen}
        onOpenChange={() => {
          onOpenChange()
          reset()
          clearErrors()
          set_tab("BY_CONTACTS")
        }}
        size="4xl"
        backdrop="blur"
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <ModalContent>
            {(onClose) => (
              <React.Fragment>
                <ModalHeader className="flex flex-col gap-1">
                  Novo Chat
                </ModalHeader>
                <ModalBody>
                  <ButtonGroup fullWidth>
                    <Button
                      onPress={() => {
                        set_tab("BY_CONTACTS")
                        reset()
                        clearErrors()
                      }}
                    >
                      Meus Contatos
                    </Button>
                    {/* <Button
                      onPress={() => {
                        set_tab("MANUAL")
                        reset()
                        clearErrors()
                      }}
                    >
                      Inserir Número Manualmente
                    </Button> */}
                  </ButtonGroup>

                  {tab === "BY_CONTACTS" && (
                    <React.Fragment>
                      <Select
                        label="Selecione o Contato"
                        selectionMode="single"
                        radius="sm"
                        {...register("contact_id")}
                        disabledKeys={uncheckedContacts}
                        description="Você pode selecioner apenas Contatos Verificados!"
                      >
                        {contacts.map((contact) => (
                          <SelectItem key={contact.id} textValue={contact.name}>
                            <div className="flex gap-2 items-center">
                              <Avatar
                                alt={contact.name}
                                className="flex-shrink-0"
                                size="sm"
                                src={contact.avatar_url}
                              />
                              <div className="flex flex-col">
                                <span className="text-small">
                                  {contact.name}{" "}
                                  {contact.checked
                                    ? ""
                                    : "- Não Verificado pelo WhatsApp"}
                                </span>
                                <span className="text-tiny text-default-400">
                                  {contact.remote_jid}
                                </span>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </Select>

                      {errors.contact_id && (
                        <div className="mt-4">
                          <Alert
                            color="danger"
                            title={errors.contact_id.message}
                          />
                        </div>
                      )}
                    </React.Fragment>
                  )}

                  {tab === "MANUAL" && (
                    <div className="grid grid-rows-2 gap-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Select
                            label="Selecione o Código do País"
                            selectionMode="single"
                            radius="sm"
                            defaultSelectedKeys={["55"]}
                            {...register("country_code", { value: "55" })}
                          >
                            {countries.map((country) => (
                              <SelectItem
                                key={country.key}
                                startContent={
                                  <span className="text-lg leading-none" aria-hidden="true">{country.icon}</span>
                                }
                              >
                                {country.label}
                              </SelectItem>
                            ))}
                          </Select>
                        </div>

                        <div>
                          <InputMask
                            component={Input}
                            mask="(__) _ ____-____"
                            replacement="_"
                            onChange={handleChange}
                            label="Número"
                            placeholder="Digite o número"
                          />
                        </div>
                      </div>

                      <Input
                        label="Número Final"
                        readOnly
                        value={`${
                          watch("country_code")
                            ? `+${watch("country_code")}`
                            : ""
                        } ${watch("number") ? watch("number") : ""}`}
                      />

                      <div className="flex flex-col gap-3">
                        {errors.country_code && (
                          <Alert
                            color="danger"
                            title={errors.country_code.message}
                          />
                        )}
                        {errors.number && (
                          <Alert color="danger" title={errors.number.message} />
                        )}
                      </div>
                    </div>
                  )}
                </ModalBody>
                <ModalFooter>
                  <Button color="danger" variant="light" onPress={onClose}>
                    Fechar
                  </Button>
                  <Button color="primary" type="submit">
                    Criar
                  </Button>
                </ModalFooter>
              </React.Fragment>
            )}
          </ModalContent>
        </form>
      </Modal>
    </React.Fragment>
  )
}
