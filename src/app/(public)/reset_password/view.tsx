import React from "react"
import useResetPasswordModel from "./model"
import { AuthLayout } from "@/components/auth/auth-layout"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function ResetPasswordView({
  register,
  handleSubmit,
  onSubmit,
  errors,
}: ReturnType<typeof useResetPasswordModel>) {
  return (
    <AuthLayout
      title="Bem-vindo de volta"
      subtitle="Entre com sua conta para acessar o painel"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            placeholder="seu@email.com"
            // disabled={isLoading}
            {...register("email")}
          />
        </div>

        <Button className="w-full" type="submit">
          Recuperar Senha
        </Button>

        <p className="text-center">
          <Link
            href="/"
            className="text-center text-sm text-primary hover:underline"
          >
            Fazer Login
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
