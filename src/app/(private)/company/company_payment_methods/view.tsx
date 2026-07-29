"use client"

import React from "react"
import useCompanyPaymentMethodsModel from "./model"
import { Input } from "@/components/ui/input"
import { Button } from "@nextui-org/react"
import { Switch } from "@nextui-org/react"
import { Pencil, Trash2, Plus, CreditCard } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function CompanyPaymentMethodsView({
  isLoading,
  paymentMethods,
  register,
  handleSubmit,
  onSubmit,
  errors,
  isEditing,
  handleDelete,
  handleEdit,
  handleCancel,
}: ReturnType<typeof useCompanyPaymentMethodsModel>) {
  return (
    <Card className="bg-card border-0 shadow-sm h-fit">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-teal-50 rounded-lg">
            <CreditCard className="h-5 w-5 text-primary" />
          </div>
          <CardTitle className="text-lg font-semibold text-foreground">Formas de Pagamento</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <form onSubmit={handleSubmit(onSubmit)} className="mb-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Nome da Forma de Pagamento (Ex: Cartão de Crédito, Pix)</label>
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
              <label className="text-sm font-medium text-foreground">Status</label>
              <div>
                <Switch
                  {...register("status")}
                  defaultSelected={true}
                  size="sm"
                  color="success"
                  disabled={isLoading}
                >
                  Ativo
                </Switch>
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
          <h3 className="text-sm font-semibold text-foreground mb-3">Formas de Pagamento Cadastradas:</h3>
          {paymentMethods.length === 0 ? (
            <div className="space-y-2">
              {[
                { id: "default-1", name: "Cartão Crédito", status: true },
                { id: "default-2", name: "Cartão Débito", status: true },
                { id: "default-3", name: "Dinheiro", status: true },
                { id: "default-4", name: "Pix", status: true }
              ].map((paymentMethod) => (
                <div key={paymentMethod.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${paymentMethod.status ? 'bg-primary' : 'bg-gray-400'}`}></div>
                    <span className="text-sm font-medium text-foreground">{paymentMethod.name}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button 
                      isIconOnly 
                      size="sm" 
                      variant="light" 
                      onClick={() => handleEdit(paymentMethod.id)}
                      className="h-8 w-8 hover:bg-muted"
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button 
                      isIconOnly 
                      size="sm" 
                      variant="light" 
                      onClick={() => handleDelete(paymentMethod.id)}
                      className="h-8 w-8 hover:bg-red-100 text-primary"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {paymentMethods.map((paymentMethod) => (
                <div key={paymentMethod.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${paymentMethod.status ? 'bg-primary' : 'bg-gray-400'}`}></div>
                    <span className="text-sm font-medium text-foreground">{paymentMethod.name}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button 
                      isIconOnly 
                      size="sm" 
                      variant="light" 
                      onClick={() => handleEdit(paymentMethod.id)}
                      className="h-8 w-8 hover:bg-muted"
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button 
                      isIconOnly 
                      size="sm" 
                      variant="light" 
                      onClick={() => handleDelete(paymentMethod.id)}
                      className="h-8 w-8 hover:bg-red-100 text-primary"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
