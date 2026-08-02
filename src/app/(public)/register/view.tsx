import React from "react"
import useRegisterPageModel from "./model"
import { Label } from "@/components/ui/label"
import { AuthLayout } from "@/components/auth/auth-layout"
import { Input } from "@/components/ui/input"
import { Input as CustomInput } from "@nextui-org/react"
import { Button } from "@/components/ui/button"
import { EyeIcon, EyeOffIcon } from "lucide-react"
import Link from "next/link"

export default function RegisterPageView({
  isLoading,
  showPassword,
  setShowPassword,
  register,
  handleSubmit,
  onSubmit,
  errors,
}: ReturnType<typeof useRegisterPageModel>) {
  return (
    <AuthLayout
      title="Crie sua conta"
      subtitle="Comece sua jornada com RestaurantAI"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="nome">Nome completo</Label>
          <Input
            {...register("name", { required: true })}
            type="text"
            placeholder="João Silva"
            disabled={isLoading}
          />
          {errors?.name && (
            <div className="text-red-600 dark:text-red-400">{errors?.name?.message}</div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="nome_empresa">Nome da Empresa</Label>
          <Input
            {...register("company_name", { required: true })}
            type="text"
            placeholder="Minha Empresa Ltda"
            disabled={isLoading}
          />
          {errors?.company_name && (
            <div className="text-red-600 dark:text-red-400">{errors?.company_name?.message}</div>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="nome_empresa">Domínio da Empresa</Label>
          <CustomInput
            radius="none"
            endContent={
              <div className="pointer-events-none flex items-center">
                <span className="text-default-400 text-small">
                  .myia.com.br
                </span>
              </div>
            }
            labelPlacement="outside"
            placeholder="minhaempresa"
            type="text"
            {...register("domain_server", { required: true })}
          />
          {errors?.domain_server && (
            <div className="text-red-600 dark:text-red-400">{errors?.domain_server?.message}</div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            {...register("email", { required: true })}
            type="email"
            placeholder="seu@email.com"
            disabled={isLoading}
          />
          {errors?.email && (
            <div className="text-red-600 dark:text-red-400">{errors?.email?.message}</div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <div className="relative">
            <Input
              {...register("password", { required: true })}
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              disabled={isLoading}
            />

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeOffIcon className="h-4 w-4 text-muted-foreground" />
              ) : (
                <EyeIcon className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>

            {errors?.password && (
              <div className="text-red-600 dark:text-red-400">{errors?.password?.message}</div>
            )}
          </div>
        </div>

        <Button className="w-full" type="submit" disabled={isLoading}>
          {isLoading ? "Criando conta..." : "Criar conta"}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Já tem uma conta?{" "}
          <Link href="/" className="text-primary hover:underline">
            Faça Login
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
