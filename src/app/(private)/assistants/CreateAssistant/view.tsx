"use client"

import React from "react"
import useCreateAssistantModel from "./model"
import { Button } from "@nextui-org/react"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Avatar } from "@nextui-org/react"
import { Modal } from "@/app/components/Modal"

export default function CreateAssistantView({
  isLoading,
  isOpen,
  setIsOpen,
  register,
  handleSubmit,
  onSubmit,
  errors,
  watch,
}: ReturnType<typeof useCreateAssistantModel>) {
  return (
    <Modal.Root
      isOpen={isOpen}
      triggerButton={
        <Button radius="sm" color="primary">
          Criar Assistente
        </Button>
      }
      onOpenChange={(open) => {
        if (isLoading) return
        setIsOpen(open)
      }}
    >
      <Modal.Header>
        <div>Primeiros Passos...</div>
      </Modal.Header>
      <Modal.Body>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4">
            <div>
              <label>Nome</label>
              <Input
                type="text"
                placeholder="Defina um nome para o assistente"
                {...register("name", { required: true })}
                disabled={isLoading}
              />

              <span className="text-red-500">{errors.name?.message}</span>
            </div>

            <div>
              <label>Avatar (Opcional por em quanto...)</label>
              <Input
                type="text"
                placeholder="URL do avatar"
                {...register("avatar")}
                disabled={isLoading}
              />

              <span className="text-red-500">{errors.name?.message}</span>
            </div>

            {watch("name") && (
              <Card className="p-5">
                <div className="flex items-center gap-3">
                  {watch("avatar") ? (
                    <Avatar
                      isBordered
                      showFallback
                      radius="full"
                      size="lg"
                      src={watch("avatar") as string}
                    />
                  ) : (
                    <Avatar
                      isBordered
                      showFallback
                      radius="full"
                      size="lg"
                      src="https://s3.techtopus.dev/myia/avatar_Julia_d1aebcd9-81b5-460e-a45f-eabb608c73c8"
                    />
                  )}

                  <div className="text-xl">Nome: {watch("name")}</div>
                </div>
              </Card>
            )}

            <Button
              color="primary"
              variant={isLoading ? "solid" : "bordered"}
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? "Aguarde..." : "Criar"}
            </Button>
          </div>
        </form>
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
  )
}
