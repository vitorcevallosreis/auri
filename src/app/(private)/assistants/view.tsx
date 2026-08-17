"use client"

import React from "react"
import useAssistantsPageModel from "./model"
import { Avatar } from "@nextui-org/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import PreviewAssistant from "./PreviewAssistant"
import { Button } from "@/components/ui/button"
import { Button as DeleteButton } from "@nextui-org/react"
import CreateAssistant from "./CreateAssistant"
import { DashboardLayout } from "@/app/layout/dashboard-layout"
import { MessageSquare, CreditCard, Clock, Users, Sparkles, Bot, CheckCircle } from "lucide-react"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty"
import { AuriGrafismo } from "@/components/brand/auri-grafismo"

// Agentes Especializados predefinidos
const specializedAgents = [
  {
    id: "recepcao-ia",
    name: "Ana - Recepção IA",
    description: "Atende pacientes 24/7 via WhatsApp com linguagem natural",
    icon: <MessageSquare className="h-6 w-6" />,
    features: [
      "Agendamento automático",
      "Confirmação de consultas", 
      "Cadastro de novos pacientes",
      "Reagendamento inteligente"
    ],
    status: "Disponível",
    color: "bg-primary",
    type: "specialist"
  },
  {
    id: "convenios-ia", 
    name: "Clara - Convênios IA",
    description: "Automatiza toda gestão de convênios médicos",
    icon: <CreditCard className="h-6 w-6" />,
    features: [
      "Verificação de elegibilidade",
      "Autorização automática",
      "Preenchimento de guias",
      "Comunicação com planos"
    ],
    status: "Em breve",
    color: "bg-gray-400",
    type: "specialist"
  }
]

export default function AssistantsPageView({
  isLoading,
  assistants,
  router,
  deleteAssistant,
}: ReturnType<typeof useAssistantsPageModel>) {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Assistentes Inteligentes</h1>
          <p className="text-muted-foreground">Automatize sua clínica com agentes especializados que trabalham 24/7</p>
        </div>

        {/* Agentes Especializados Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold text-foreground">Agentes Especializados</h2>
            <Badge className="bg-accent/20 text-foreground hover:bg-accent/30">Novidade</Badge>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {specializedAgents.map((agent) => (
              <Card key={agent.id} className="relative overflow-hidden border-2 hover:border-primary/20 transition-all duration-200 hover:shadow-lg">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${agent.color} text-white`}>
                        {agent.icon}
                      </div>
                      <div>
                        <CardTitle className="text-lg font-semibold">{agent.name}</CardTitle>
                        <CardDescription className="text-sm">{agent.description}</CardDescription>
                      </div>
                    </div>
                    <Badge 
                      variant={agent.status === "Disponível" ? "default" : "secondary"}
                      className={agent.status === "Disponível" ? "bg-primary hover:bg-primary/90" : ""}
                    >
                      {agent.status}
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-foreground">Principais funcionalidades:</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {agent.features.map((feature, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CheckCircle className="h-3 w-3 text-primary" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="pt-2">
                    <Button 
                      className={`w-full ${agent.status === "Disponível" 
                        ? "bg-primary hover:bg-primary/90 text-primary-foreground" 
                        : "bg-muted text-muted-foreground cursor-not-allowed"
                      }`}
                      disabled={agent.status !== "Disponível"}
                    >
                      {agent.status === "Disponível" ? "Ativar Agente" : "Aguarde o lançamento"}
                    </Button>
                  </div>
                </CardContent>
                
                {agent.status === "Disponível" && (
                  <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-primary/10 to-transparent" />
                )}
              </Card>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Assistentes Personalizados Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-xl font-semibold text-foreground">Assistentes Personalizados</h2>
            </div>
            <CreateAssistant />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <Card key={index} className="p-5">
                  <div className="flex items-center space-x-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-[200px]" />
                      <Skeleton className="h-4 w-[160px]" />
                    </div>
                  </div>
                </Card>
              ))
            ) : assistants?.length > 0 ? (
              assistants.map((assistant, index: number) => (
                <Card key={index} className="p-5 hover:shadow-md transition-shadow duration-200">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Avatar
                        isBordered
                        showFallback
                        radius="full"
                        size="md"
                        src={assistant?.avatar as string}
                        className="border-primary/20"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-foreground">{assistant?.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {assistant?.purpose || "Sem especialização definida"}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {assistant?.llm}
                      </Badge>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-border">
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/assistants/${assistant?.id}`)}
                          className="border-primary/20 text-primary hover:bg-primary/5"
                        >
                          Configurar
                        </Button>
                        <PreviewAssistant assistant={assistant} />
                      </div>

                      <DeleteButton
                        color="danger" 
                        size="sm"
                        variant="light"
                        onPress={() => deleteAssistant(assistant?.id)}
                      >
                        Excluir
                      </DeleteButton>
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              <div className="col-span-full">
                <Card className="relative overflow-hidden border-2 border-dashed border-border">
                  <AuriGrafismo
                    className="absolute -bottom-1/2 left-1/2 -z-10 w-[80%] max-w-md -translate-x-1/2 text-accent"
                    opacity={0.1}
                  />
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Bot />
                      </EmptyMedia>
                      <EmptyTitle>Nenhum assistente personalizado</EmptyTitle>
                      <EmptyDescription>
                        Comece com nossos Agentes Especializados ou crie seu próprio
                        assistente personalizado.
                      </EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                      <CreateAssistant />
                    </EmptyContent>
                  </Empty>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
