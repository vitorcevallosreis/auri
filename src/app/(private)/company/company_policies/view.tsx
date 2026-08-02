"use client"

import React from "react"
import useCompanyPoliciesModel from "./model"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@nextui-org/react"
import { Switch } from "@nextui-org/react"
import { Pencil, Trash2, Plus, FileText } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Controller } from "react-hook-form"

export default function CompanyPoliciesView({
  isLoading,
  policies,
  register,
  handleSubmit,
  onSubmit,
  errors,
  isEditing,
  handleDelete,
  handleEdit,
  handleCancel,
  control,
}: ReturnType<typeof useCompanyPoliciesModel>) {
  return (
    <Card className="bg-card border-0 shadow-sm h-fit">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-teal-50 rounded-lg dark:bg-teal-500/10">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <CardTitle className="text-lg font-semibold text-foreground">Políticas Gerais</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <form onSubmit={handleSubmit(onSubmit)} className="mb-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Nome da Política (Ex: Política de Cancelamento)</label>
              <Input
                type="text"
                placeholder="-"
                {...register("name")}
                disabled={isLoading}
                className="border-border focus:border-primary focus:ring-ring"
              />
              {errors.name && (
                <p className="text-red-500 text-sm">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Descrição (Descreva detalhadamente a política)</label>
              <Textarea
                placeholder="-"
                rows={3}
                {...register("description")}
                disabled={isLoading}
                className="border-border focus:border-primary focus:ring-ring resize-none"
              />
              {errors.description && (
                <p className="text-red-500 text-sm">{errors.description.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Status</label>
              <div>
                <Controller
                  name="status"
                  control={control}
                  defaultValue={true}
                  render={({ field }) => (
                    <Switch
                      isSelected={field.value}
                      onValueChange={field.onChange}
                      size="sm"
                      color="success"
                      disabled={isLoading}
                    >
                      Ativo
                    </Switch>
                  )}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button 
                type="submit" 
                disabled={isLoading}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-1.5 px-3 rounded-md text-sm transition-colors"
              >
                {isLoading ? "Salvando..." : isEditing ? "Atualizar" : "Adicionar"}
              </Button>
              {isEditing && (
                <Button 
                  type="button" 
                  onClick={handleCancel}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-1.5 px-3 rounded-md text-sm transition-colors"
                >
                  Cancelar
                </Button>
              )}
            </div>
          </div>
        </form>

        <div className="mt-6">
          <h3 className="text-sm font-semibold text-foreground mb-3">Políticas Cadastradas:</h3>
          {policies.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              <p className="font-medium">Política de Cancelamento</p>
              <p className="text-xs mt-1">Cancelamentos e reagendamentos devem ser feitos com pelo menos 24 horas de antecedência.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {policies.map((policy) => (
                <div key={policy.id} className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${policy.status ? 'bg-primary' : 'bg-gray-400'}`}></div>
                      <span className="text-sm font-medium text-foreground">{policy.name}</span>
                    </div>
                    <div className="flex gap-1">
                      <Button 
                        isIconOnly 
                        size="sm" 
                        variant="light" 
                        onClick={() => handleEdit(policy.id)}
                        className="h-8 w-8 hover:bg-muted"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button 
                        isIconOnly 
                        size="sm" 
                        variant="light" 
                        onClick={() => handleDelete(policy.id)}
                        className="h-8 w-8 text-primary hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{policy.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
