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
    color: "bg-[#00897B]",
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
          <h1 className="text-3xl font-bold text-gray-900">Assistentes Inteligentes</h1>
          <p className="text-gray-600">Automatize sua clínica com agentes especializados que trabalham 24/7</p>
        </div>

        {/* Agentes Especializados Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#00897B]" />
            <h2 className="text-xl font-semibold text-gray-900">Agentes Especializados</h2>
            <Badge className="bg-[#E0F2F1] text-[#00897B] hover:bg-[#B2DFDB]">Novidade</Badge>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {specializedAgents.map((agent) => (
              <Card key={agent.id} className="relative overflow-hidden border-2 hover:border-[#00897B]/20 transition-all duration-200 hover:shadow-lg">
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
                      className={agent.status === "Disponível" ? "bg-[#00897B] hover:bg-[#00796B]" : ""}
                    >
                      {agent.status}
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-gray-700">Principais funcionalidades:</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {agent.features.map((feature, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm text-gray-600">
                          <CheckCircle className="h-3 w-3 text-[#00897B]" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="pt-2">
                    <Button 
                      className={`w-full ${agent.status === "Disponível" 
                        ? "bg-[#00897B] hover:bg-[#00796B] text-white" 
                        : "bg-gray-100 text-gray-500 cursor-not-allowed"
                      }`}
                      disabled={agent.status !== "Disponível"}
                    >
                      {agent.status === "Disponível" ? "Ativar Agente" : "Aguarde o lançamento"}
                    </Button>
                  </div>
                </CardContent>
                
                {agent.status === "Disponível" && (
                  <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-[#00897B]/10 to-transparent" />
                )}
              </Card>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200" />

        {/* Assistentes Personalizados Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-gray-600" />
              <h2 className="text-xl font-semibold text-gray-900">Assistentes Personalizados</h2>
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
                        className="border-[#00897B]/20"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{assistant?.name}</div>
                        <div className="text-sm text-gray-500">
                          {assistant?.purpose || "Sem especialização definida"}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {assistant?.llm}
                      </Badge>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/assistants/${assistant?.id}`)}
                          className="border-[#00897B]/20 text-[#00897B] hover:bg-[#00897B]/5"
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
                <Card className="p-8 text-center border-dashed border-2 border-gray-200">
                  <div className="space-y-4">
                    <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                      <Bot className="h-6 w-6 text-gray-400" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-medium text-gray-900">Nenhum assistente personalizado</h3>
                      <p className="text-gray-500 max-w-md mx-auto">
                        Comece com nossos Agentes Especializados ou crie seu próprio assistente personalizado.
                      </p>
                    </div>
                    <CreateAssistant />
                  </div>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
