import React from "react"
import useLoginPageModel from "./model"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { EyeIcon, EyeOffIcon } from "lucide-react"
import { AuthLayout } from "@/components/auth/auth-layout"
import Link from "next/link"

export default function LoginPageView({
  handleSubmit,
  handleSignIn,
  register,
  isLoading,
  setShowPassword,
  showPassword,
}: ReturnType<typeof useLoginPageModel>) {
  return (
    <AuthLayout
      title="Bem-vindo de volta"
      subtitle="Entre com sua conta para acessar o painel"
    >
      <form onSubmit={handleSubmit(handleSignIn)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            placeholder="seu@email.com"
            required
            disabled={isLoading}
            {...register("email")}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              required
              disabled={isLoading}
              className="pr-10"
              {...register("password")}
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
          </div>
        </div>

        <Button className="w-full" type="submit" disabled={isLoading}>
          {isLoading ? "Entrando..." : "Entrar"}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Não tem uma conta?{" "}
          <Link href="/register" className="text-primary hover:underline">
            Cadastre-se
          </Link>
        </p>

        <p className="text-center">
          <Link
            href="/reset_password"
            className="text-center text-sm text-primary hover:underline"
          >
            Recuperar Senha
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
