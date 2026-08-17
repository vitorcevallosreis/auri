import React from "react"
import useCompanyAddressModel from "./model"
import { Input } from "@/components/ui/input"
import { Button, CircularProgress } from "@nextui-org/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MapPin } from "lucide-react"

export default function CompanyAddressView({
  isLoading,
  register,
  handleSubmit,
  onSubmit,
  errors,
}: ReturnType<typeof useCompanyAddressModel>) {
  return (
    <>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-teal-50 rounded-lg dark:bg-teal-500/10">
            <MapPin className="h-5 w-5 text-primary" />
          </div>
          <CardTitle className="text-xl font-semibold text-foreground">Endereço da Empresa</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">CEP</label>
              <Input
                type="text"
                placeholder="68354-145"
                {...register("zip_code", { required: "O CEP é obrigatório." })}
                maxLength={8}
                disabled={isLoading}
                className="border-border focus:border-primary focus:ring-ring"
              />
              {errors.zip_code && (
                <p className="text-red-500 text-sm">{errors.zip_code.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Rua</label>
              <Input
                type="text"
                placeholder="Rua Amazonas"
                {...register("street")}
                disabled={isLoading}
                className="border-border focus:border-primary focus:ring-ring"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Número</label>
              <Input
                type="text"
                placeholder="282"
                {...register("number")}
                disabled={isLoading}
                className="border-border focus:border-primary focus:ring-ring"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Complemento</label>
              <Input
                type="text"
                placeholder="Complemento"
                {...register("complement")}
                disabled={isLoading}
                className="border-border focus:border-primary focus:ring-ring"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Bairro</label>
            <Input
              type="text"
              placeholder="Vale Dourado"
              {...register("neighborhood")}
              disabled={isLoading}
              className="border-border focus:border-green-500 focus:ring-green-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Cidade</label>
              <Input
                type="text"
                placeholder="Canaã dos Carajás"
                {...register("city")}
                disabled={isLoading}
                className="border-border focus:border-primary focus:ring-ring"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Estado</label>
              <Input
                type="text"
                placeholder="Pará"
                {...register("state")}
                disabled={isLoading}
                className="border-border focus:border-primary focus:ring-ring"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">SIGLA</label>
              <Input
                type="text"
                placeholder="PA"
                {...register("state_code")}
                disabled={isLoading}
                className="border-border focus:border-primary focus:ring-ring"
              />
            </div>
          </div>

          <Button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-2 px-4 rounded-lg transition-colors"
          >
            {isLoading ? "Atualizando..." : "Atualizar Informações de Endereço"}
          </Button>

          {isLoading && (
            <div className="flex justify-center mt-4">
              <CircularProgress aria-label="Carregando..." size="sm" />
            </div>
          )}
        </form>
      </CardContent>
    </>
  )
}
