"use client"

import React from "react"
import useChatEmptyModel from "./model"
import { AuriGrafismo } from "@/components/brand/auri-grafismo"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty"

/**
 * Estado vazio da inbox.
 *
 * O grupo de avatares empilhados acima do título é o visual original e foi
 * mantido a pedido. O que NÃO voltou junto foi o dropdown que ficava atrás do
 * balão "+": ele listava nomes fictícios ("Ana Silva", "João Santos"…) em links
 * `href="#"` e dependia das classes `hs-dropdown` do Preline, biblioteca que
 * não está instalada aqui — era markup morto que nunca abriu. O "+" continua
 * como parte da composição, mas agora é decorativo em vez de fingir ser botão.
 */

const AVATARES = [
  "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?ixlib=rb-4.0.3&auto=format&fit=facearea&facepad=2&w=300&h=300&q=80",
  "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?ixlib=rb-4.0.3&auto=format&fit=facearea&facepad=2&w=300&h=300&q=80",
  "https://images.unsplash.com/photo-1582750433449-648ed127bb54?ixlib=rb-4.0.3&auto=format&fit=facearea&facepad=2&w=300&h=300&q=80",
  "https://images.unsplash.com/photo-1607990281513-2c110a25bd8c?ixlib=rb-4.0.3&auto=format&fit=facearea&facepad=2&w=300&h=300&q=80",
]

export default function ChatEmptyView({}: ReturnType<
  typeof useChatEmptyModel
>) {
  return (
    <div className="relative flex h-full min-h-[24rem] items-center justify-center overflow-hidden">
      {/* Grafismo da marca: decorativo, atrás do conteúdo, sem rotação nem distorção */}
      <AuriGrafismo
        className="absolute -bottom-1/3 left-1/2 -z-10 w-[130%] max-w-2xl -translate-x-1/2 text-accent"
        opacity={0.1}
      />

      <Empty>
        <EmptyHeader>
          <EmptyMedia>
            {/* Grupo de avatares empilhados, como era antes. `aria-hidden`
                porque é ilustração: são fotos genéricas, não pacientes reais,
                e anunciar "Paciente" 4x num leitor de tela seria mentira. */}
            <div className="flex justify-center -space-x-2" aria-hidden="true">
              {AVATARES.map((src) => (
                <img
                  key={src}
                  className="inline-block size-[46px] rounded-full object-cover ring-2 ring-white dark:ring-neutral-900"
                  src={src}
                  alt=""
                />
              ))}
              <span className="inline-flex size-[46px] items-center justify-center rounded-full border-2 border-white bg-gray-100 text-sm font-medium leading-none text-gray-700 shadow-sm dark:border-neutral-800 dark:bg-neutral-700 dark:text-white">
                +
              </span>
            </div>
          </EmptyMedia>
          <EmptyTitle>Central de Comunicação</EmptyTitle>
          <EmptyDescription>
            Selecione uma conversa para iniciar o atendimento. Atendimento
            humanizado e eficiente com seus pacientes, num só lugar.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  )
}
