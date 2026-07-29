"use client"

import React from "react"
import useTrainingsModel from "./model"
// import { Textarea } from "@/components/ui/textarea"
import { Button, Textarea } from "@nextui-org/react"

export default function TrainingsView({
  register,
  handleSubmit,
  onSubmit,
}: ReturnType<typeof useTrainingsModel>) {
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="bg-muted p-2 mb-4">🦾 Treinamentos</div>

      <div className="grid grid-rows-4 gap-3">
        <div>
          <div className="flex justify-between items-center mb-3">
            <div>Passo a Passo</div>
            <Button radius="sm" color="default">
              Precisa de Ajuda? ⚡️
            </Button>
          </div>

          <Textarea
            variant="bordered"
            placeholder="Descreva um pouco sobre o Assistente..."
            maxRows={10}
            radius="sm"
            {...register("step_by_step")}
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-3">
            <div>Saudações</div>
            <Button radius="sm" color="default">
              Precisa de Ajuda? ⚡️
            </Button>
          </div>

          <Textarea
            variant="bordered"
            placeholder="Descreva um pouco sobre o Assistente..."
            maxRows={10}
            radius="sm"
            {...register("greetings")}
          />
        </div>
        <div>
          <div className="flex justify-between items-center mb-3">
            <div>Comportamento</div>
            <Button radius="sm" color="default">
              Precisa de Ajuda? ⚡️
            </Button>
          </div>

          <Textarea
            variant="bordered"
            placeholder="Descreva um pouco sobre o Assistente..."
            maxRows={10}
            radius="sm"
            {...register("behavior_text")}
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-3">
            <div>Tópicos Evitados</div>
            <Button radius="sm" color="default">
              Precisa de Ajuda? ⚡️
            </Button>
          </div>

          <Textarea
            variant="bordered"
            placeholder="Descreva um pouco sobre o Assistente..."
            maxRows={10}
            radius="sm"
            {...register("avoided_topics")}
          />
        </div>
      </div>

      <div className="my-2">
        <Button type="submit" radius="sm" color="primary">
          Atualizar Treinamento
        </Button>
      </div>
    </form>
  )
}
