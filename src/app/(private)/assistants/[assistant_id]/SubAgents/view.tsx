"use client"

import React from "react"
import useSubAgentsModel, { SubAgent } from "./model"
import { Switch } from "@/components/ui/switch"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { PlusCircle, Pencil, Trash2, Save, X, Plus, Minus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

export default function SubAgentsView() {
  const {
    subAgents,
    isLoading,
    currentSubAgent,
    setCurrentSubAgent,
    handleSubmit,
    register,
    errors,
    reset,
    onSubmit,
    deleteSubAgent,
    toggleStatus,
    isEditing,
    setIsEditing,
    addExample,
    removeExample,
    examples,
    setExamples
  } = useSubAgentsModel()

  const handleExampleChange = (index: number, value: string) => {
    const newExamples = [...examples]
    newExamples[index] = value
    setExamples(newExamples)
  }

  const handleOpenEditDialog = (subAgent: SubAgent) => {
    setCurrentSubAgent(subAgent)
    setIsEditing(true)
  }

  const handleOpenCreateDialog = () => {
    setCurrentSubAgent(null)
    setIsEditing(false)
    reset()
    setExamples([])
  }

  const handleCloseDialog = () => {
    setCurrentSubAgent(null)
    setIsEditing(false)
    reset()
    setExamples([])
  }

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Sub-Agentes</h1>
        <Dialog>
          <DialogTrigger asChild>
            <Button
              variant="default"
              onClick={handleOpenCreateDialog}
              className="flex items-center gap-2"
            >
              <PlusCircle className="h-4 w-4" />
              Novo Sub-Agente
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>
                {isEditing ? "Editar Sub-Agente" : "Criar Novo Sub-Agente"}
              </DialogTitle>
              <DialogDescription>
                Configure os detalhes do sub-agente. Clique em salvar quando terminar.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">
                    Nome
                  </Label>
                  <div className="col-span-3">
                    <Input
                      id="name"
                      placeholder="Nome do sub-agente"
                      {...register("name")}
                      className={cn(errors.name ? "border-red-500" : "")}
                    />
                    {errors.name && (
                      <p className="text-red-500 text-sm mt-1">{errors.name.message?.toString()}</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="status" className="text-right">
                    Status
                  </Label>
                  <div className="col-span-3 flex items-center gap-2">
                    <Switch
                      id="status"
                      {...register("status")}
                      defaultChecked={currentSubAgent?.status === "active"}
                      onCheckedChange={(checked) => 
                        register("status").onChange({
                          target: { name: "status", value: checked ? "active" : "disabled" }
                        })
                      }
                    />
                    <span>
                      {currentSubAgent?.status === "active" || 
                      (!currentSubAgent && !isEditing) ? "Ativo" : "Desativado"}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-4 items-start gap-4">
                  <Label htmlFor="prompt" className="text-right mt-2">
                    Prompt
                  </Label>
                  <div className="col-span-3">
                    <Textarea
                      id="prompt"
                      placeholder="Descreva o comportamento e função deste sub-agente"
                      rows={6}
                      {...register("prompt")}
                      className={cn(errors.prompt ? "border-red-500" : "")}
                    />
                    {errors.prompt && (
                      <p className="text-red-500 text-sm mt-1">{errors.prompt.message?.toString()}</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-4 items-start gap-4">
                  <Label className="text-right mt-2">
                    Exemplos de Interação
                  </Label>
                  <div className="col-span-3">
                    <div className="space-y-2">
                      {examples.map((example, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Input
                            value={example}
                            onChange={(e) => handleExampleChange(index, e.target.value)}
                            placeholder="Exemplo de interação"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            type="button"
                            onClick={() => removeExample(index)}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={addExample}
                        className="flex items-center gap-1"
                      >
                        <Plus className="h-4 w-4" />
                        Adicionar exemplo
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancelar
                </Button>
                <Button type="submit">Salvar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-40">
          <p>Carregando sub-agentes...</p>
        </div>
      ) : subAgents.length === 0 ? (
        <div className="flex flex-col justify-center items-center h-40 border rounded-md p-6 bg-muted">
          <p className="text-muted-foreground mb-4">Nenhum sub-agente encontrado</p>
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="default"
                onClick={handleOpenCreateDialog}
                className="flex items-center gap-2"
              >
                <PlusCircle className="h-4 w-4" />
                Criar Primeiro Sub-Agente
              </Button>
            </DialogTrigger>
            {/* Conteúdo do diálogo é o mesmo que acima */}
          </Dialog>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {subAgents.map((subAgent) => (
            <Card key={subAgent.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <CardTitle>{subAgent.name}</CardTitle>
                  <Badge
                    variant={subAgent.status === "active" ? "default" : "secondary"}
                    className="ml-2"
                  >
                    {subAgent.status === "active" ? "Ativo" : "Desativado"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pb-2">
                <div className="space-y-2">
                  <div>
                    <p className="text-sm font-medium">Prompt:</p>
                    <p className="text-sm text-muted-foreground line-clamp-2">{subAgent.prompt}</p>
                  </div>
                  {subAgent.examples && subAgent.examples.length > 0 && (
                    <div>
                      <p className="text-sm font-medium">Exemplos:</p>
                      <ul className="text-sm text-muted-foreground list-disc list-inside">
                        {subAgent.examples.slice(0, 2).map((example, index) => (
                          <li key={index} className="line-clamp-1">{example}</li>
                        ))}
                        {subAgent.examples.length > 2 && (
                          <p className="text-xs text-muted-foreground">
                            +{subAgent.examples.length - 2} exemplos
                          </p>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <div className="flex items-center">
                  <Switch
                    id={`status-${subAgent.id}`}
                    checked={subAgent.status === "active"}
                    onCheckedChange={() => toggleStatus(subAgent.id)}
                  />
                  <Label htmlFor={`status-${subAgent.id}`} className="ml-2">
                    {subAgent.status === "active" ? "Ativo" : "Desativado"}
                  </Label>
                </div>
                <div className="flex gap-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleOpenEditDialog(subAgent)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    {/* Conteúdo do diálogo é o mesmo que acima */}
                  </Dialog>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => deleteSubAgent(subAgent.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
