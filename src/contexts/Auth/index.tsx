"use client"

import React, { createContext, useEffect, useState } from "react"
import {
  SignInData,
  AuthContextType,
  AuthProviderProps,
  SignUnData,
  AuthToken,
} from "./interfaces"
import { useRouter } from "next/navigation"
import { Login, Register } from "../../api/auth"
import { supabase } from "@/lib/supabase/config"
import { toast } from "sonner"
import SUPA_TABLES from "../supa_tables"
import { setCookie, destroyCookie, parseCookies } from "nookies"
import { useAuthStore } from "@/lib/auth-store"
import { useQueryClient } from '@tanstack/react-query'

export const AuthContext = createContext({} as AuthContextType)

export function AuthProvider({ children }: AuthProviderProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [user, set_user] = useState({
    user_id: "",
    company_id: "",
    hashed_password: "",
  })

  // Obter o estado do useAuthStore
  const authStore = useAuthStore()
  // Obter o queryClient para pré-carregar os dados da empresa
  const queryClient = useQueryClient()
  
  useEffect(() => {
    // Carregar dados de autenticação dos cookies
    const authData = getAuthToken()
    
    if (authData) {
      // Sincronizar os dados do AuthContext com o useAuthStore
      authStore.setAuth(
        authData.company_id,
        authData.user_id,
        authData.hashed_password
      )
      
      // Atualizar o estado local
      set_user(authData)
    } else {
      // Nenhum dado de autenticação encontrado nos cookies
      // Garantir que o estado local e o authStore estejam limpos
      authStore.clearAuth()
      set_user({
        user_id: "",
        company_id: "",
        hashed_password: "",
      })
    }
  }, [])

  function getAuthToken() {
    const cookies = parseCookies()
    const authData = cookies.authData

    if (authData) {
      try {
        const parsedToken: AuthToken = JSON.parse(authData)
        return parsedToken
      } catch (error) {
        // Erro ao analisar token de autenticação
        // Limpar o cookie inválido
        destroyCookie(null, "authData")
        return null
      }
    }

    return null
  }

  async function signIn({ email, password }: SignInData): Promise<any> {
    try {
      setIsLoading(true)
      const result = await Login(email, password)

      if (!result.success || result.error) throw result.error

      const authData = {
        company_id: result?.user?.company_id,
        user_id: result?.user?.id,
        hashed_password: result?.user?.hashed_password,
      }

      // Salvar nos cookies com configurações de segurança aprimoradas
      setCookie(null, "authData", JSON.stringify(authData), {
        path: "/",
        maxAge: 60 * 60 * 24 * 7, // Expira em 7 dias
        secure: process.env.NODE_ENV === "production",
        sameSite: "Strict",
      })
      
      // Sincronizar com o useAuthStore
      authStore.setAuth(
        authData.company_id,
        authData.user_id,
        authData.hashed_password
      )
      
      set_user(authData) // Atualizar o usuário no estado local também
      
      // Carregar dados da empresa diretamente após o login
      if (authData.company_id) {
        // Pré-carregar os dados básicos da empresa no cache do React Query
        queryClient.prefetchQuery({
          queryKey: ['company', authData.company_id],
          queryFn: async () => {
            const { data, error } = await supabase
              .from(SUPA_TABLES.table_companies)
              .select()
              .match({ id: authData.company_id })
              .single()
              
            if (error) throw error
            return data
          }
        })
        
        // Pré-carregar o endereço da empresa
        queryClient.prefetchQuery({
          queryKey: ['companyAddress', authData.company_id],
          queryFn: async () => {
            const { data, error } = await supabase
              .from(SUPA_TABLES.table_company_addresses)
              .select()
              .eq('company_id', authData.company_id)
              .single()
              
            if (error && error.code !== 'PGRST116') throw error // Ignorar erro 'not found'
            return data || null
          }
        })
      }

      toast.success("Login realizado com sucesso", {
        duration: 1000,
        closeButton: true,
      })

      router.push("/")
    } catch (error) {
      // Erro ao tentar fazer login
      toast.error("Erro ao tentar fazer login", {
        duration: 5000,
        closeButton: true,
      })
    } finally {
      setIsLoading(false)
    }
  }

  async function signUp(body: SignUnData): Promise<any> {
    setIsLoading(true)
    try {
      const { data: company_data, error: company_error } = await supabase
        .from(SUPA_TABLES.table_companies)
        .insert([
          { name: body.company_name, domain_server: body.domain_server },
        ])
        .select()
        .single()

      if (company_error) return

      const result = await Register({
        company_id: company_data.id,
        name: body.name,
        email: body.email,
        password: body.password,
      })

      if (!result.success) throw new Error("Não foi possível criar o usuário")

      toast.success("Cadastro Realizado com sucesso!", {
        duration: 3000,
        description: "Faça o Login para acessar sua Conta!",
        closeButton: true,
      })

      router.push("/")
    } catch (error) {
      // Erro ao tentar fazer cadastro
      toast.error("Erro ao tentar fazer Cadastro!", {
        duration: 5000,
        description: "Ocorreu um erro inesperado. Tente novamente!",
        closeButton: true,
      })
    } finally {
      setIsLoading(false)
    }
  }

  async function singOut(): Promise<void> {
    try {
      // Capturar o company_id antes de limpar os dados
      const companyId = user?.company_id
      
      // Remover cookie de autenticação de forma mais segura
      destroyCookie(null, "authData", {
        path: "/",
      })
      
      // Limpar o estado do useAuthStore
      authStore.clearAuth()
      
      // Limpar o estado local
      set_user({
        user_id: "",
        company_id: "",
        hashed_password: "",
      })
      
      // Emitir evento personalizado para notificar sobre o logout
      if (typeof window !== "undefined" && companyId) {
        const logoutEvent = new CustomEvent('myia:auth:logout', { 
          detail: { company_id: companyId } 
        });
        window.dispatchEvent(logoutEvent);
      }
      
      // Limpar caches que podem conter dados do usuário
      queryClient.clear();
      
      // Redirecionar para a página de login
      router.push("/login")

      toast.success("Logout Realizado com sucesso!", {
        duration: 5000,
        closeButton: true,
      })
    } catch (error) {
      // Erro ao fazer logout
      toast.error("Falha ao tentar fazer o Logout!", {
        duration: 5000,
        description: "Ocorreu um erro inesperado. Tente novamente.",
        closeButton: true,
      })
    }
  }

  async function checkAvailableDomain(domain_server: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from(SUPA_TABLES.table_companies)
        .select("*")
        .eq("domain_server", domain_server)

      if (data && data.length > 0) {
        toast.warning(`Domínio ${domain_server} está sendo usado!`, {
          duration: 5000,
        })
        return false // Indica que o domínio NÃO está disponível
      } else {
        toast.success(`Domínio ${domain_server} Disponível`, {
          duration: 3000,
        })
        return true // Indica que o domínio está disponível
      }
    } catch (error) {
      toast.error("Falha ao tentar verificar o domínio!", {
        duration: 5000,
        description: "Ocorreu um erro inesperado. Tente novamente.",
        closeButton: true,
      })

      return false // Tratamento de erro retorna indisponível
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        signIn,
        signUp,
        singOut,
        checkAvailableDomain,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
