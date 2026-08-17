"use client"

import React from "react"
import { DashboardLayout } from "@/app/layout/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  MessageSquare, 
  Calendar, 
  CreditCard, 
  Users, 
  Clock, 
  ArrowRight,
  CheckCircle,
  Sparkles,
  Zap,
  Shield,
  TrendingUp,
  PhoneCall,
  Heart
} from "lucide-react"
import TestimonialsSection from "@/components/testimonials/TestimonialsSection"

const workflowSteps = [
  {
    id: 1,
    title: "Paciente contata",
    description: "WhatsApp, telefone ou presencial",
    icon: <PhoneCall className="h-6 w-6" />,
    color: "bg-blue-500",
    status: "active"
  },
  {
    id: 2,
    title: "Ana IA responde",
    description: "Atendimento 24/7 com linguagem natural",
    icon: <MessageSquare className="h-6 w-6" />,
    color: "bg-primary",
    status: "active"
  },
  {
    id: 3,
    title: "Agendamento automático",
    description: "Verifica disponibilidade e agenda",
    icon: <Calendar className="h-6 w-6" />,
    color: "bg-purple-500",
    status: "active"
  },
  {
    id: 4,
    title: "Clara IA valida",
    description: "Convênio verificado automaticamente",
    icon: <CreditCard className="h-6 w-6" />,
    color: "bg-orange-500",
    status: "coming-soon"
  }
]

const metrics = [
  {
    title: "Atendimentos automatizados",
    value: "89%",
    subtitle: "↑ 45% vs mês anterior",
    icon: <Zap className="h-5 w-5" />,
    color: "text-green-600 dark:text-green-400"
  },
  {
    title: "Tempo médio de resposta",
    value: "12s",
    subtitle: "↓ 85% vs atendimento manual",
    icon: <Clock className="h-5 w-5" />,
    color: "text-blue-600 dark:text-blue-400"
  },
  {
    title: "Satisfação do paciente",
    value: "9.4/10",
    subtitle: "↑ 92% recomendam",
    icon: <Heart className="h-5 w-5" />,
    color: "text-red-600 dark:text-red-400"
  }
]

const benefits = [
  {
    title: "Disponibilidade 24/7",
    description: "Seus pacientes são atendidos a qualquer hora",
    icon: <Clock className="h-5 w-5 text-primary" />
  },
  {
    title: "Zero filas de espera",
    description: "Atendimento simultâneo ilimitado",
    icon: <Users className="h-5 w-5 text-primary" />
  },
  {
    title: "Redução de custos",
    description: "Menos recepcionistas, mais eficiência",
    icon: <TrendingUp className="h-5 w-5 text-primary" />
  },
  {
    title: "Controle total",
    description: "Você supervisiona, a IA executa",
    icon: <Shield className="h-5 w-5 text-primary" />
  }
]

export default function HomePage() {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-4 py-6">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="h-6 w-6 text-primary" />
            <Badge className="bg-accent/20 text-foreground hover:bg-accent/30 px-4 py-1">
              Sua clínica no piloto automático
            </Badge>
          </div>
          <h1 className="text-4xl font-bold text-foreground">
            Bem-vindo ao futuro da sua clínica
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Veja como a Auri automatiza 89% dos seus atendimentos enquanto você foca no que realmente importa: cuidar dos pacientes.
          </p>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {metrics.map((metric, index) => (
            <Card key={index} className="border-2 hover:shadow-lg transition-all duration-200">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className={`p-2 rounded-full bg-muted ${metric.color}`}>
                  {metric.icon}
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-foreground">{metric.value}</div>
                  <div className="text-xs text-muted-foreground">{metric.subtitle}</div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-medium text-foreground">{metric.title}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Workflow Visual */}
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Como funciona o piloto automático
            </CardTitle>
            <CardDescription>
              Fluxo completo de atendimento automatizado da sua clínica
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {workflowSteps.map((step, index) => (
                <div key={step.id} className="relative">
                  <div className="flex flex-col items-center text-center space-y-4">
                    <div className={`p-4 rounded-full ${step.color} text-white shadow-lg`}>
                      {step.icon}
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-semibold text-foreground">{step.title}</h3>
                      <p className="text-sm text-muted-foreground">{step.description}</p>
                      {step.status === "coming-soon" && (
                        <Badge variant="outline" className="text-xs">Em breve</Badge>
                      )}
                      {step.status === "active" && (
                        <div className="flex items-center justify-center gap-1 text-green-600 dark:text-green-400">
                          <CheckCircle className="h-4 w-4" />
                          <span className="text-xs font-medium">Ativo</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Seta conectora */}
                  {index < workflowSteps.length - 1 && (
                    <div className="hidden md:block absolute top-8 -right-3 text-gray-300">
                      <ArrowRight className="h-6 w-6" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Benefits Grid */}
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Por que clínicas escolhem a Auri
            </CardTitle>
            <CardDescription>
              Vantagens comprovadas por centenas de clínicas automatizadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-start gap-3 p-4 rounded-lg hover:bg-muted transition-colors">
                  <div className="flex-shrink-0 mt-1">
                    {benefit.icon}
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-semibold text-foreground">{benefit.title}</h4>
                    <p className="text-sm text-muted-foreground">{benefit.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Testimonials Section */}
        <TestimonialsSection />

        {/* CTA Section */}
        <Card className="border-2 bg-gradient-to-r from-primary/5 to-accent/20/30">
          <CardContent className="p-8 text-center space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-foreground">
                Pronto para colocar sua clínica no piloto automático?
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Junte-se a centenas de clínicas que já automatizaram seus atendimentos e aumentaram a satisfação dos pacientes.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3">
                Ativar Ana - Recepção IA
              </Button>
              <Button variant="outline" className="border-primary text-primary hover:bg-primary/5 px-8 py-3">
                Ver demonstração
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
