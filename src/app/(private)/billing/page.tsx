"use client"

import React, { useState } from "react"
import { DashboardLayout } from "@/app/layout/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar } from "@nextui-org/react"
import { 
  Search, 
  Plus, 
  Calendar,
  Filter,
  CreditCard,
  Clock,
  CheckCircle,
  AlertCircle,
  X,
  FileText,
  Receipt
} from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

// Mock data for billing
const billingData = [
  {
    id: 1,
    createdDate: "15 Jul, 10h34",
    patient: {
      name: "Ana Beatriz",
      avatar: "/images/no_image.png"
    },
    value: "R$ 200,00",
    paymentMethod: "Bradesco Saúde",
    paymentMethodColor: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
    status: "Guia Gerada",
    statusColor: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
    statusIcon: <CheckCircle className="h-4 w-4" />,
    billing: "Aguardando",
    billingIcon: <Clock className="h-4 w-4 text-amber-500" />
  },
  {
    id: 2,
    createdDate: "15 Jul, 10h32",
    patient: {
      name: "Carlos Albuquerque",
      avatar: "/images/no_image.png"
    },
    value: "R$ 180,00",
    paymentMethod: "SulAmérica",
    paymentMethodColor: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
    status: "Aguardando Lote",
    statusColor: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    statusIcon: <Clock className="h-4 w-4" />,
    billing: "Aguardando",
    billingIcon: <Clock className="h-4 w-4 text-amber-500" />
  },
  {
    id: 3,
    createdDate: "15 Jul, 10h31",
    patient: {
      name: "Marina Prado",
      avatar: "/images/no_image.png"
    },
    value: "R$ 150,00",
    paymentMethod: "Link de Pagamento",
    paymentMethodColor: "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300",
    status: "Paga",
    statusColor: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300",
    statusIcon: <CheckCircle className="h-4 w-4" />,
    billing: "Emitido",
    billingIcon: <FileText className="h-4 w-4 text-green-600 dark:text-green-400" />
  },
  {
    id: 4,
    createdDate: "15 Jul, 10h30",
    patient: {
      name: "Guilherme Soares",
      avatar: "/images/no_image.png"
    },
    value: "R$ 150,00",
    paymentMethod: "Múltiplos",
    paymentMethodColor: "bg-muted text-foreground",
    status: "Pendente",
    statusColor: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-300",
    statusIcon: <AlertCircle className="h-4 w-4" />,
    billing: "Após o pagamento",
    billingIcon: <Clock className="h-4 w-4 text-muted-foreground" />
  },
  {
    id: 5,
    createdDate: "15 Jul, 10h25",
    patient: {
      name: "Juliana Martins",
      avatar: "/images/no_image.png"
    },
    value: "R$ 180,00",
    paymentMethod: "Porto Saúde",
    paymentMethodColor: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
    status: "Paga",
    statusColor: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300",
    statusIcon: <CheckCircle className="h-4 w-4" />,
    billing: "Emitido",
    billingIcon: <FileText className="h-4 w-4 text-green-600 dark:text-green-400" />
  },
  {
    id: 6,
    createdDate: "15 Jul, 10h22",
    patient: {
      name: "Rafael Costa",
      avatar: "/images/no_image.png"
    },
    value: "R$ 200,00",
    paymentMethod: "Amil",
    paymentMethodColor: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300",
    status: "Atrasada",
    statusColor: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
    statusIcon: <X className="h-4 w-4" />,
    billing: "Aguardando",
    billingIcon: <Clock className="h-4 w-4 text-amber-500" />
  }
]

export default function BillingPage() {
  const [activeTab, setActiveTab] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")

  const tabs = [
    { id: "all", label: "Cobranças", count: billingData.length },
    { id: "reconciled", label: "Conciliadas", count: 3 },
    { id: "not-reconciled", label: "Não conciliadas", count: 3 }
  ]

  const filteredData = billingData.filter(item =>
    item.patient.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-foreground">Gestão Financeira</h1>
            <p className="text-muted-foreground">Automatize cobranças e conciliação bancária</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="border-primary text-primary hover:bg-primary/5">
              <Receipt className="h-4 w-4 mr-2" />
              Cobrar atendimentos
            </Button>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <Plus className="h-4 w-4 mr-2" />
              Nova Cobrança
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-4">
            {/* Tabs */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex items-center gap-2 pb-2 border-b-2 transition-colors font-medium",
                      activeTab === tab.id
                        // Sublinhado no menta (elemento decorativo, pode ser
                        // sólido) + rótulo em petróleo, que carrega o texto.
                        ? "border-accent text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span>{tab.label}</span>
                    <Badge variant="secondary" className="bg-muted text-muted-foreground">
                      {tab.count}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4 pt-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Data de Criação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="week">Esta semana</SelectItem>
                  <SelectItem value="month">Este mês</SelectItem>
                </SelectContent>
              </Select>

              <Select>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">Paga</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="overdue">Atrasada</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="outline" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Data de Criação</TableHead>
                  <TableHead className="font-semibold">Paciente</TableHead>
                  <TableHead className="font-semibold">Valor</TableHead>
                  <TableHead className="font-semibold">Meio</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Faturamento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((item) => (
                  <TableRow key={item.id} className="hover:bg-muted/50 cursor-pointer">
                    <TableCell className="text-muted-foreground">
                      {item.createdDate}
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={item.patient.avatar}
                          size="sm"
                          showFallback
                          className="border"
                        />
                        <div>
                          <div className="font-medium text-foreground">{item.patient.name}</div>
                          <div className="text-sm text-muted-foreground">Paciente</div>
                        </div>
                      </div>
                    </TableCell>
                    
                    <TableCell className="font-semibold text-foreground">
                      {item.value}
                    </TableCell>
                    
                    <TableCell>
                      <Badge className={cn("font-medium", item.paymentMethodColor)}>
                        {item.paymentMethod}
                      </Badge>
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className={cn("p-1 rounded-full", item.statusColor.replace("text-", "").replace("bg-", "text-"))}>
                          {item.statusIcon}
                        </div>
                        <Badge className={cn("font-medium", item.statusColor)}>
                          {item.status}
                        </Badge>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {item.billingIcon}
                        <span className="text-muted-foreground">{item.billing}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total em Aberto</p>
                  <p className="text-2xl font-bold text-foreground">R$ 1.180,00</p>
                </div>
                <div className="p-3 bg-red-100 rounded-full dark:bg-red-500/15">
                  <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Recebido Este Mês</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">R$ 3.240,00</p>
                </div>
                <div className="p-3 bg-green-100 rounded-full dark:bg-green-500/15">
                  <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Aguardando</p>
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">R$ 760,00</p>
                </div>
                <div className="p-3 bg-amber-100 rounded-full dark:bg-amber-500/15">
                  <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Taxa de Conversão</p>
                  <p className="text-2xl font-bold text-primary">94%</p>
                </div>
                <div className="p-3 bg-accent/20 rounded-full">
                  <CreditCard className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
