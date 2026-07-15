"use client"

import React from "react"
import useSettingModel from "./model"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { text_ligth } from "@/hooks/useFonts"
import { Button } from "@nextui-org/react"
import { Select, SelectItem, Avatar } from "@nextui-org/react"
import { SectionTitle, SubsectionTitle } from "@/components/ui/section-title"

export default function SettingView({
  assistant,
  llms,
  register,
  handleSubmit,
  onSubmit,
}: ReturnType<typeof useSettingModel>) {
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <SectionTitle>🧑‍🔧 Configurações do Assistente</SectionTitle>

      <div className="flex flex-col gap-4">
        <div>
          <SubsectionTitle>Inteligência do Assistente</SubsectionTitle>
          <Select
            className="w-full"
            label="Modelo de IA"
            {...register("llm", { required: true })}
            defaultSelectedKeys={[assistant?.llm as string]}
          >
            {llms?.map((llm) => (
              <SelectItem
                key={llm.name}
                startContent={
                  <Avatar
                    alt="Argentina"
                    className="w-6 h-6"
                    src={llm?.icon as string}
                  />
                }
              >
                {llm.name}
              </SelectItem>
            ))}
          </Select>
        </div>

        <div>
          <SubsectionTitle>Objetivo do Assistente</SubsectionTitle>
          <div className={`${text_ligth} text-sm mb-2`}>
            Descreva um pouco sobre como o assistente deve se comportar e qual
            seu objetivo durante a conversa.
          </div>

          <Textarea
            placeholder="Descreva um pouco sobre como o assistente deve se comportar..."
            {...register("objective")}
          />
        </div>

        <div>
          <SubsectionTitle>Estratégia do Assistente</SubsectionTitle>
          <div className={`${text_ligth} text-sm mb-2`}>
            Descreva a estratégia utilizada pelo bot para realizar suas funções
          </div>

          <Textarea
            placeholder="Descreva a estratégia utilizada pelo bot para realizar suas funções..."
            {...register("strategy")}
          />
        </div>

        <div>
          <SubsectionTitle>Telefone de Fallback</SubsectionTitle>
          <div className={`${text_ligth} text-sm mb-2`}>
            Número de telefone para redirecionamento caso o agente tenha problemas
          </div>

          <Input
            placeholder="Ex: +5511999999999"
            {...register("tel_fallback")}
          />
        </div>

        <div>
          <Button type="submit" radius="sm" color="primary">
            Salvar
          </Button>
        </div>
      </div>
    </form>
  )
}
