"use client"

import React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { 
  Clock, 
  Edit, 
  MessageSquare, 
  Plus, 
  Send, 
  Trash2, 
  RefreshCw, 
  MailCheck 
} from "lucide-react"
import useFollowUpsModel from "./model"
import { Badge } from "@/components/ui/badge"
import { FollowUpStep } from "@/contexts/Assistants/interfaces"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"

const FollowUpsView = () => {
  const {
    isLoading,
    followUpSteps,
    isEditing,
    isModalOpen,
    form,
    openModal,
    closeModal,
    editStep,
    deleteStep,
    onSubmit,
    refreshSteps
  } = useFollowUpsModel()

  // Formatar o tempo de atraso em um formato legível
  const formatDelay = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes} minutos`
    } else if (minutes === 60) {
      return "1 hora"
    } else if (minutes < 1440 && minutes % 60 === 0) {
      return `${minutes / 60} horas`
    } else if (minutes === 1440) {
      return "1 dia"
    } else if (minutes > 1440 && minutes % 1440 === 0) {
      return `${minutes / 1440} dias`
    } else {
      // Formato mais complexo (ex: 1 dia e 2 horas)
      const days = Math.floor(minutes / 1440)
      const hours = Math.floor((minutes % 1440) / 60)
      const mins = minutes % 60
      
      let result = ""
      if (days > 0) result += `${days} dia${days > 1 ? 's' : ''} `
      if (hours > 0) result += `${days > 0 ? 'e ' : ''}${hours} hora${hours > 1 ? 's' : ''} `
      if (mins > 0 && days === 0) result += `${hours > 0 ? 'e ' : ''}${mins} minuto${mins > 1 ? 's' : ''}`
      
      return result.trim()
    }
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Follow-ups Automáticos</h1>
          <p className="text-muted-foreground">
            Configure sequências de follow-up para contatos inativos
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={refreshSteps}
            disabled={isLoading}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <Button onClick={openModal}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Passo
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin mr-2">
            <RefreshCw className="h-8 w-8 text-primary" />
          </div>
          <p>Carregando follow-ups...</p>
        </div>
      ) : followUpSteps.length === 0 ? (
        <Card className="w-full border-dashed border-2 bg-muted/50">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-medium mb-2">Nenhum follow-up configurado</h3>
            <p className="text-muted-foreground text-center max-w-md mb-4">
              Configure passos sequenciais de follow-up para que o assistente acompanhe contatos que ficam inativos.
            </p>
            <Button onClick={openModal}>
              <Plus className="h-4 w-4 mr-2" />
              Criar primeiro passo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {followUpSteps
            .sort((a, b) => a.step_number - b.step_number)
            .map((step, index) => (
              <FollowUpCard 
                key={step.id} 
                step={step} 
                isLast={index === followUpSteps.length - 1}
                onEdit={editStep}
                onDelete={deleteStep}
              />
            ))}
        </div>
      )}

      <Dialog open={isModalOpen} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Editar passo de follow-up" : "Novo passo de follow-up"}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="step_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ordem</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min={1} 
                          {...field} 
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Posição na sequência
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="delay_minutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tempo de espera (minutos)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min={1} 
                          {...field} 
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Tempo de inatividade
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mensagem</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Digite a mensagem que será enviada neste passo..." 
                        className="min-h-[120px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Texto que será enviado ao contato
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="auto_close"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 border p-4 rounded-md">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="font-semibold">Encerrar atendimento</FormLabel>
                      <FormDescription>
                        Se ativado, o atendimento será encerrado automaticamente após o envio desta mensagem
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline" type="button">Cancelar</Button>
                </DialogClose>
                <Button type="submit" disabled={isLoading}>
                  {isEditing ? "Atualizar" : "Criar"} passo
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Componente para exibir um passo de follow-up
const FollowUpCard = ({ 
  step, 
  isLast,
  onEdit, 
  onDelete 
}: { 
  step: FollowUpStep, 
  isLast: boolean,
  onEdit: (step: FollowUpStep) => void, 
  onDelete: (id: string) => Promise<void> 
}) => {
  return (
    <Card className="relative">
      {!isLast && (
        <div className="absolute left-12 top-[calc(100%+1px)] h-6 w-0.5 bg-border" />
      )}
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="w-8 h-8 flex items-center justify-center rounded-full p-0">
            {step.step_number}
          </Badge>
          <CardTitle className="text-lg">
            Passo {step.step_number}
          </CardTitle>
          {step.auto_close && (
            <Badge variant="destructive" className="ml-2">
              <MailCheck className="h-3 w-3 mr-1" />
              Encerra atendimento
            </Badge>
          )}
        </div>
        <CardDescription className="flex items-center">
          <Clock className="h-3 w-3 mr-1" />
          Após {step.delay_minutes} minutos de inatividade
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="bg-muted p-3 rounded-md">
          <p className="whitespace-pre-line">{step.message}</p>
        </div>
      </CardContent>
      <CardFooter className="justify-end gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={() => onEdit(step)}>
          <Edit className="h-4 w-4 mr-1" />
          Editar
        </Button>
        <Button variant="destructive" size="sm" onClick={() => onDelete(step.id)}>
          <Trash2 className="h-4 w-4 mr-1" />
          Excluir
        </Button>
      </CardFooter>
    </Card>
  )
}

export default FollowUpsView
