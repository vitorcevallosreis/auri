"use client"

import React from "react"
import useProfileModel from "./model"
import { Avatar } from "@nextui-org/react"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { User, ShoppingCart } from "lucide-react"
import { text_ligth, text_regular } from "@/hooks/useFonts"
import clsx from "clsx"
import {
  Button,
  ButtonGroup,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@nextui-org/react"
import { Modal } from "@/app/components/Modal"
import { SectionTitle, SubsectionTitle } from "@/components/ui/section-title"

export const ChevronDownIcon = () => {
  return (
    <svg
      fill="none"
      height="14"
      viewBox="0 0 24 24"
      width="14"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M17.9188 8.17969H11.6888H6.07877C5.11877 8.17969 4.63877 9.33969 5.31877 10.0197L10.4988 15.1997C11.3288 16.0297 12.6788 16.0297 13.5088 15.1997L15.4788 13.2297L18.6888 10.0197C19.3588 9.33969 18.8788 8.17969 17.9188 8.17969Z"
        fill="currentColor"
      />
    </svg>
  )
}

export default function ProfileView({
  assistant,
  propmts,
  isOpen,
  setIsOpen,
  set_prompt,
  isLoading,
  register,
  handleSubmit,
  onSubmit,
  setValue,
  errors,
  watch,
  behaviorsMap,
  labelsMap,
}: ReturnType<typeof useProfileModel>) {
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <SectionTitle>😎 Perfil do Assistente</SectionTitle>

      <div className="flex items-center gap-3 mb-4">
        {assistant?.avatar && (
          <Avatar
            isBordered
            showFallback
            radius="full"
            size="lg"
            src={assistant?.avatar as string}
            alt={assistant?.name}
          />
        )}

        <div className="w-full flex justify-between items-center gap-3">
          <div className="w-full">
            <Label>Nome do assistente</Label>
            <Input {...register("name", { required: true })} type="text" />
          </div>
          <div className="w-full">
            <div className="w-full">
              <Label>Comportamento do assistente</Label>
            </div>
            <div className="w-full">
              <ButtonGroup variant="flat" className="w-full">
                <Button className="w-full" radius="sm">
                  {labelsMap[watch("behavior") as string]}
                </Button>
                <Dropdown placement="bottom-end" className="w-full">
                  <DropdownTrigger>
                    <Button isIconOnly radius="sm">
                      <ChevronDownIcon />
                    </Button>
                  </DropdownTrigger>
                  <DropdownMenu
                    disallowEmptySelection
                    aria-label="Merge options"
                    className="w-full"
                    selectedKeys={
                      watch("behavior")
                        ? [watch("behavior") as string]
                        : undefined
                    }
                    selectionMode="single"
                    onSelectionChange={(value) => {
                      const val = Array.from(value)[0] as string
                      setValue("behavior", val)
                    }}
                  >
                    {Object.keys(labelsMap).map((key) => (
                      <DropdownItem
                        key={key}
                        description={
                          behaviorsMap[key as keyof typeof behaviorsMap]
                        }
                      >
                        {labelsMap[key as keyof typeof labelsMap]}
                      </DropdownItem>
                    ))}
                  </DropdownMenu>
                </Dropdown>
              </ButtonGroup>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="mb-4">
          <div
            className={clsx(text_regular.className, "text-lg font-semibold")}
          >
            Finalidade
          </div>

          <div className="w-full mt-3">
            <div className="flex justify-between gap-2">
              <div
                onClick={() => setValue("purpose", "Suporte")}
                className={`w-full flex items-center gap-3 border ${
                  watch("purpose") === "Suporte"
                    ? "border-blue-500"
                    : "border-gray-200"
                } p-3 rounded-md hover:border-blue-500 cursor-pointer`}
              >
                <User />
                <div>
                  <div className={clsx(text_ligth, "text-md")}>Suporte</div>
                  <div className={clsx(text_ligth, "text-sm")}>
                    Use essa opção sempre que o objetivo do seu assistente for
                    prestar suporte.
                  </div>
                </div>
              </div>
              <div
                onClick={() => setValue("purpose", "Vendas")}
                className={`w-full flex items-center gap-3 border ${
                  watch("purpose") === "Vendas"
                    ? "border-blue-500"
                    : "border-gray-200"
                } p-3 rounded-md hover:border-blue-500 cursor-pointer`}
              >
                <ShoppingCart />
                <div>
                  <div className={clsx(text_ligth, "text-md")}>Vendas</div>
                  <div className={clsx(text_ligth, "text-sm")}>
                    Use sempre que quiser criar um assistente que tem como foco
                    falar de um produto.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex justify-between items-center mb-3">
            <div>Descreva um pouco sobre o Assistente</div>

            <Modal.Root
              isOpen={isOpen}
              triggerButton={
                <Button radius="sm" color="primary">
                  Precisa de Ajuda?
                </Button>
              }
              onOpenChange={(open) => {
                if (isLoading) return
                setIsOpen(open)
              }}
            >
              <Modal.Header>
                <div>Alguns Promps para te ajudar</div>
              </Modal.Header>
              <Modal.Body>
                {propmts.map((prompt, index: number) => (
                  <div
                    key={index}
                    className="flex flex-col gap-2 shadow-md p-2 border border-gray-300 rounded-md"
                  >
                    <div>
                      <Button
                        onPress={() => set_prompt(prompt.text)}
                        className="rounded-md"
                      >
                        Usar este modelo
                      </Button>
                    </div>
                    <div>
                      <Textarea
                        placeholder="Descreva um pouco sobre o Assistente..."
                        defaultValue={prompt.text}
                        rows={2}
                        readOnly
                      />
                    </div>
                  </div>
                ))}
              </Modal.Body>
              <Modal.Footer>
                <Button
                  color="default"
                  variant="light"
                  onPress={() => {
                    if (isLoading) return

                    setIsOpen(false)
                  }}
                >
                  {isLoading ? "Aguarde..." : "Fechar"}
                </Button>
              </Modal.Footer>
            </Modal.Root>
          </div>

          <Textarea
            {...register("description", { required: true })}
            placeholder="Descreva um pouco sobre o Assistente..."
            rows={10}
          />

          {errors.description && (
            <div className="text-red-500 text-sm mt-1">
              {errors.description.message}
            </div>
          )}

          <div className="text-right mt-1 text-gray-400">
            {assistant?.description?.length} / 500
          </div>
        </div>

        <Button type="submit" radius="sm" color="primary">
          Salvar
        </Button>
      </div>
    </form>
  )
}
