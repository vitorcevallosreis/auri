"use client"

import React from "react"
import useTrainingsModel from "./model"
import { Textarea } from "@nextui-org/react"
import { SectionTitle, SubsectionTitle } from "@/components/ui/section-title"

export default function PersonalityView({
  assistant,
}: ReturnType<typeof useTrainingsModel>) {
  return (
    <div>
      <SectionTitle>🌟 Personalidade</SectionTitle>
      <div className="grid grid-rows-4 gap-3">
        <div>
          <SubsectionTitle>Personalidade do Assistente</SubsectionTitle>

          <Textarea
            variant="bordered"
            placeholder="Descreva um pouco sobre o Assistente..."
            maxRows={15}
            radius="sm"
            defaultValue={assistant?.identity as string}
          />
        </div>
      </div>
    </div>
  )
}
