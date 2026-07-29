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

      // Autentica no Supabase Auth (auth.users) para obter uma sessão real,
      // necessária para que o RLS (auth_company_id()) funcione nas consultas seguintes.
      const { data: sessionData, error: sessionError } =
        await supabase.auth.signInWithPassword({ email, password })

      if (sessionError || !sessionData?.user) throw sessionError

      // Resolve o tenant (company_id) do usuário autenticado via myia_users,
      // que referencia auth.users(id) no novo schema multi-tenant.
      const { data: myiaUser, error: myiaUserError } = await supabase
        .from("myia_users")
        .select("company_id, role")
        .eq("id", sessionData.user.id)
        .single()

      if (myiaUserError || !myiaUser) {
        await supabase.auth.signOut()
        throw myiaUserError || new Error("Usuário sem empresa vinculada")
      }

      const authData = {
        company_id: myiaUser.company_id,
        user_id: sessionData.user.id,
        hashed_password: "",
      }

      // Salvar nos cookies com configurações de segurança aprimoradas.
      //
      // `secure` segue o protocolo REAL da página, não o NODE_ENV. Em
      // https://app.auri.global o resultado é o mesmo de antes; a diferença
      // aparece num build de produção servido em http:// (preview em rede,
      // `next start` local, VPS antes do TLS), onde o navegador DESCARTA
      // silenciosamente um cookie Secure — o middleware deixa de ver `authData`
      // e devolve o usuário para /login sem nenhum erro visível.
      setCookie(null, "authData", JSON.stringify(authData), {
        path: "/",
        maxAge: 60 * 60 * 24 * 7, // Expira em 7 dias
        secure:
          typeof window !== "undefined" &&
          window.location.protocol === "https:",
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

      // "/" é o painel real ("Piloto Automático" no menu), dentro do
      // (private)/layout com sidebar. NÃO usar "/dashboard": aquela rota é uma
      // página legada órfã, fora do DashboardLayout e com dados fictícios.
      router.push("/")
    } catch (error) {
      // Sem log o erro real fica invisível: credencial errada, linha ausente em
      // myia_users e falha de RLS viravam todos o mesmo toast genérico, sem
      // nenhuma pista de qual dos três aconteceu.
      console.error("[auth] falha no login:", error)

      const description =
        error instanceof Error ? error.message : "Tente novamente."

      toast.error("Erro ao tentar fazer login", {
        duration: 5000,
        description,
        closeButton: true,
      })
    } finally {
      setIsLoading(false)
    }
  }

  async function signUp(body: SignUnData): Promise<any> {
    setIsLoading(true)
    try {
      // O cadastro roda inteiro no servidor (/api/auth/signup): criar o usuário
      // no Supabase Auth, a empresa e o vínculo em myia_users exige service role
      // — do browser a RLS bloqueia o insert em myia_companies.
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: body.name,
          email: body.email,
          password: body.password,
          company_name: body.company_name,
          domain_server: body.domain_server,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        const messages: Record<string, string> = {
          email_taken: "Este e-mail já está cadastrado. Tente fazer login.",
          domain_taken: "Este domínio já está sendo usado, escolha outro.",
          invalid_email: "Forneça um e-mail válido.",
          weak_password: "A senha deve ter no mínimo 6 caracteres.",
          missing_fields: "Preencha todos os campos.",
        }

        toast.error("Não foi possível criar a conta", {
          duration: 5000,
          description: messages[result?.error] ?? "Erro inesperado. Tente novamente!",
          closeButton: true,
        })

        return
      }

      toast.success("Cadastro realizado com sucesso!", {
        duration: 3000,
        description: "Entrando na sua conta...",
        closeButton: true,
      })

      // Já autentica: signIn cria a sessão do Supabase (necessária para a RLS),
      // resolve o company_id e redireciona.
      await signIn({ email: body.email, password: body.password })
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

      // Encerrar a sessão real do Supabase Auth (limpa o JWT usado pelo RLS)
      await supabase.auth.signOut()

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
      console.error("[auth] falha no logout:", error)

      toast.error("Falha ao tentar fazer o Logout!", {
        duration: 5000,
        description: "Ocorreu um erro inesperado. Tente novamente.",
        closeButton: true,
      })
    }
  }

  async function checkAvailableDomain(domain_server: string): Promise<boolean> {
    try {
      // Server-side: a RLS de myia_companies só deixa o usuário ver a PRÓPRIA
      // empresa, então uma consulta anônima daqui sempre voltaria vazia e diria
      // "disponível" para qualquer domínio, inclusive os já usados.
      const response = await fetch(
        `/api/auth/signup?domain=${encodeURIComponent(domain_server)}`,
      )

      if (!response.ok) throw new Error("falha na checagem de domínio")

      const { available } = await response.json()

      if (!available) {
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
