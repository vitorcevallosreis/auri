"use client"

import React from "react"
import useCreateContactModel from "./model"
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  useDisclosure,
  Select,
  SelectItem,
  Avatar,
  Input,
  Alert,
} from "@nextui-org/react"
import { InputMask } from "@react-input/mask"

export default function CreateContactView({
  register,
  handleSubmit,
  onSubmit,
  errors,
  countries,
  state_codes,
  handleChange,
  watch,
  final_number,
}: ReturnType<typeof useCreateContactModel>) {
  const { isOpen, onOpen, onOpenChange } = useDisclosure()
  return (
    <>
      <Button onPress={onOpen} className="bg-[#00897B] hover:bg-[#007366] text-white">Cadastrar Paciente</Button>
      <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="3xl">
        <form onSubmit={handleSubmit(onSubmit)}>
          <ModalContent>
            {(onClose) => (
              <>
                <ModalHeader className="flex flex-col gap-1">
                  Cadastrar Paciente
                </ModalHeader>
                <ModalBody>
                  <div className="grid grid-rows-1 gap-3">
                    <Input label="Nome" {...register("name")} />

                    <Select
                      label="Selecione o Código do País"
                      selectionMode="single"
                      radius="sm"
                      defaultSelectedKeys={["55"]}
                      {...register("country_code", { value: 55 })}
                    >
                      {countries.map((country) => (
                        <SelectItem
                          key={country.key}
                          startContent={
                            <Avatar
                              alt="Argentina"
                              className="w-6 h-6 rounded-full"
                              src={country.icon}
                            />
                          }
                        >
                          {country.label}
                        </SelectItem>
                      ))}
                    </Select>

                    <div className="grid grid-cols-2 gap-3">
                      <Select
                        label="Selecione o Código do Estado"
                        selectionMode="single"
                        radius="sm"
                        defaultSelectedKeys={["65"]}
                        {...register("state_code", { value: 65 })}
                      >
                        {state_codes.map((country) => (
                          <SelectItem key={country.key}>
                            {country.label}
                          </SelectItem>
                        ))}
                      </Select>

                      <div>
                        {watch("state_code") <= 31 ? (
                          <InputMask
                            component={Input}
                            mask="_ ____-____"
                            replacement="_"
                            onChange={handleChange}
                            label="Número"
                            placeholder="Digite o número"
                            showMask
                          />
                        ) : (
                          <InputMask
                            component={Input}
                            mask="____-____"
                            replacement="_"
                            onChange={handleChange}
                            label="Número"
                            placeholder="Digite o número"
                            showMask
                          />
                        )}
                      </div>
                    </div>

                    <Input label="Número Final" readOnly value={final_number} />

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
                </ModalBody>
                <ModalFooter>
                  <Button color="danger" variant="light" onPress={onClose}>
                    Fechar
                  </Button>
                  <Button color="primary" type="submit" className="bg-[#00897B] hover:bg-[#007366] text-white">
                    Criar
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
