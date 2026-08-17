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
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

/**
 * Estado vazio da inbox.
 *
 * O grupo de avatares empilhados acima do título é o visual original, mantido a
 * pedido — são fotos ilustrativas, não contatos reais.
 *
 * O balão "+" ao lado deles é o único elemento interativo: abre um menu com as
 * conversas mais recentes e, ao clicar numa, seleciona aquela conversa. Ele
 * substitui um dropdown antigo que listava nomes fictícios em links `href="#"`
 * e dependia das classes `hs-dropdown` do Preline, biblioteca não instalada —
 * markup morto que nunca abriu.
 *
 * O menu lista SÓ conversas que já existem. Criar conversa nova não é possível
 * hoje: não há insert em `myia_chat` em lugar nenhum do app (nem o botão "Novo
 * Chat" faz isso — seu onSubmit é um stub). Listar contatos sem conversa daria
 * itens clicáveis que não levariam a lugar nenhum.
 */

const AVATARES = [
  "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?ixlib=rb-4.0.3&auto=format&fit=facearea&facepad=2&w=300&h=300&q=80",
  "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?ixlib=rb-4.0.3&auto=format&fit=facearea&facepad=2&w=300&h=300&q=80",
  "https://images.unsplash.com/photo-1582750433449-648ed127bb54?ixlib=rb-4.0.3&auto=format&fit=facearea&facepad=2&w=300&h=300&q=80",
  "https://images.unsplash.com/photo-1607990281513-2c110a25bd8c?ixlib=rb-4.0.3&auto=format&fit=facearea&facepad=2&w=300&h=300&q=80",
]

export default function ChatEmptyView({
  contacts,
  openChat,
}: ReturnType<typeof useChatEmptyModel>) {
  const temConversas = contacts.length > 0

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
            <div className="flex justify-center -space-x-2">
              {/* Ilustração: fotos genéricas, não pacientes reais. `aria-hidden`
                  para o leitor de tela não anunciar 4 avatares sem significado
                  antes do único item que de fato faz algo (o "+"). */}
              <div className="flex -space-x-2" aria-hidden="true">
                {AVATARES.map((src) => (
                  <img
                    key={src}
                    className="inline-block size-[46px] rounded-full object-cover ring-2 ring-white dark:ring-neutral-900"
                    src={src}
                    alt=""
                  />
                ))}
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger
                  disabled={!temConversas}
                  aria-label={
                    temConversas
                      ? "Abrir conversas recentes"
                      : "Nenhuma conversa recente"
                  }
                  title={
                    temConversas
                      ? "Conversas recentes"
                      : "Nenhuma conversa ainda"
                  }
                  className="inline-flex size-[46px] items-center justify-center rounded-full border-2 border-white bg-gray-100 text-sm font-medium leading-none text-gray-700 shadow-sm transition-colors hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-default disabled:opacity-60 disabled:hover:bg-gray-100 dark:border-neutral-800 dark:bg-neutral-700 dark:text-white dark:hover:bg-neutral-600 dark:disabled:hover:bg-neutral-700"
                >
                  +
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel>Conversas recentes</DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  {contacts.map((contact) => (
                    <DropdownMenuItem
                      key={contact.chat_id}
                      onSelect={() => openChat(contact.chat_id)}
                      className="gap-2"
                    >
                      {/* Avatar pequeno inline em vez do <ContactImage>
                          compartilhado: naquele componente o fallback (bolinha
                          com a inicial) tem tamanho fixo de 46px e ignora as
                          props width/height, o que estouraria este slot de
                          32px. Ajustar o componente mudaria as outras telas
                          que já o usam. */}
                      {contact.avatar_url ? (
                        <img
                          src={contact.avatar_url}
                          alt=""
                          className="size-8 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <span
                          aria-hidden="true"
                          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-gray-500 text-sm font-semibold leading-none text-white"
                        >
                          {contact.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">
                          {contact.name}
                        </span>
                        {contact.last_message && (
                          <span className="truncate text-xs text-muted-foreground">
                            {contact.last_message}
                          </span>
                        )}
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
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
