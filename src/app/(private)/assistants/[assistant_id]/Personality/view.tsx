"use client"

import React from "react"
import usePersonalityModel from "./model"
import { Button, Textarea } from "@nextui-org/react"
import { SectionTitle, SubsectionTitle } from "@/components/ui/section-title"

export default function PersonalityView({
  register,
  handleSubmit,
  onSubmit,
}: ReturnType<typeof usePersonalityModel>) {
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <SectionTitle>🌟 Personalidade</SectionTitle>
      <div className="grid grid-rows-4 gap-3">
        <div>
          <SubsectionTitle>Personalidade do Assistente</SubsectionTitle>

          <Textarea
            variant="bordered"
            placeholder="Descreva um pouco sobre o Assistente..."
            maxRows={15}
            radius="sm"
            {...register("identity")}
          />
        </div>

        <div>
          <SubsectionTitle>Papel do Assistente</SubsectionTitle>

          <Textarea
            variant="bordered"
            placeholder="O que ele faz no atendimento: recepção, triagem, agendamento..."
            maxRows={10}
            radius="sm"
            {...register("roles")}
          />
        </div>

        <div>
          <SubsectionTitle>Quando não souber responder</SubsectionTitle>

          <Textarea
            variant="bordered"
            placeholder="O que dizer quando a pergunta fugir do que ele sabe..."
            maxRows={10}
            radius="sm"
            {...register("fallbacks")}
          />
        </div>

        <div>
          <SubsectionTitle>Como encerrar</SubsectionTitle>

          <Textarea
            variant="bordered"
            placeholder="Como se despedir ao fim do atendimento..."
            maxRows={10}
            radius="sm"
            {...register("goodbye")}
          />
        </div>
      </div>

      <div className="my-2">
        <Button type="submit" radius="sm" color="primary">
          Salvar
        </Button>
      </div>
    </form>
  )
}
