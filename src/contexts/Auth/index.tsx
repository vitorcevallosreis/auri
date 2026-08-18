"use client"

import React, { createContext, useEffect, useState } from "react"
import {
  SignInData,
  AuthContextType,
  AuthProviderProps,
  SignUnData,
  AuthToken,
  AppRole,
} from "./interfaces"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase/config"
import { toast } from "sonner"
import SUPA_TABLES from "../supa_tables"
import { setCookie, destroyCookie, parseCookies } from "nookies"
import { useAuthStore } from "@/lib/auth-store"
import { useQueryClient } from '@tanstack/react-query'

export const AuthContext = createContext({} as AuthContextType)

/** Estado deslogado. Estava repetido em três pontos que precisam concordar. */
const USUARIO_VAZIO: AuthToken = {
  user_id: "",
  company_id: "",
  hashed_password: "",
  role: "owner",
}

export function AuthProvider({ children }: AuthProviderProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [user, set_user] = useState<AuthToken>(USUARIO_VAZIO)

  // Obter o estado do useAuthStore
  const authStore = useAuthStore()
  // Obter o queryClient para pré-carregar os dados da empresa
  const queryClient = useQueryClient()
  
  /**
   * Hidrata a identidade e RECONCILIA as duas credenciais.
   *
   * O app carrega duas coisas independentes:
   *
   *   - o cookie `authData`, que o middleware lê para ROTEAR (e que não
   *     autoriza nada — ver o comentário em src/middleware.ts);
   *   - a sessão do Supabase, guardada pelo GoTrue, que é o que o RLS
   *     enxerga e portanto o que decide quais linhas existem.
   *
   * Elas podem se separar: a sessão expira, o storage é limpo, uma troca de
   * chave ou de versão do supabase-js a invalida — e o cookie, que vive 7
   * dias e não sabe de nada disso, continua lá.
   *
   * Quando isso acontece o app se comporta como logado e o banco responde
   * como anônimo. Não dá erro em lugar nenhum: o RLS simplesmente devolve
   * zero linha, e a tela renderiza vazia. Num produto clínico esse é o pior
   * modo de falha possível — o médico abre a agenda, lê "0 atendimentos" e
   * conclui que não tem consultas, quando na verdade precisa entrar de novo.
   *
   * Por isso a sessão é a fonte da verdade aqui: sem ela, o cookie é
   * descartado e a pessoa volta para o login.
   */
  useEffect(() => {
    let cancelado = false

    async function hidratar() {
      const authData = getAuthToken()

      if (!authData) {
        if (cancelado) return
        // Nenhum dado de autenticação encontrado nos cookies
        // Garantir que o estado local e o authStore estejam limpos
        authStore.clearAuth()
        set_user(USUARIO_VAZIO)
        return
      }

      // `getSession` lê do storage e não vai à rede; quando o token está
      // vencido mas o refresh ainda vale, o próprio GoTrue renova. Um `null`
      // aqui significa que não há sessão recuperável — não que a rede falhou.
      const { data } = await supabase.auth.getSession()
      if (cancelado) return

      if (!data.session) {
        console.warn(
          "[auth] cookie authData sem sessão do Supabase — a sessão expirou ou foi invalidada. Encerrando para forçar novo login."
        )
        destroyCookie(null, "authData", { path: "/" })
        authStore.clearAuth()
        set_user(USUARIO_VAZIO)
        queryClient.clear()
        // `replace`, não `push`: o estado deslogado não é um passo do
        // histórico para o qual faça sentido voltar.
        router.replace("/login")
        return
      }

      // Sincronizar os dados do AuthContext com o useAuthStore
      authStore.setAuth(authData)

      // Atualizar o estado local
      set_user(authData)
    }

    hidratar()
    return () => {
      cancelado = true
    }
  }, [])

  /**
   * A mesma reconciliação, para quando a sessão morre com a aba ABERTA.
   *
   * A checagem de montagem não cobre o caso mais incômodo: o refresh token
   * falha no meio do uso e o GoTrue emite `SIGNED_OUT`. Sem isto, a tela
   * continua montada e vai esvaziando à medida que cada consulta volta sem
   * linha — para um médico em atendimento, é a hora pior de acontecer.
   *
   * Só `SIGNED_OUT` age. `INITIAL_SESSION` chega no carregamento e é assunto
   * do efeito acima; `TOKEN_REFRESHED` é a renovação dando certo.
   */
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(async (evento) => {
      if (evento !== "SIGNED_OUT") return

      // CONFIRMAR ANTES DE DESTRUIR — `SIGNED_OUT` não quer dizer "está
      // deslogado agora", quer dizer "alguma sessão foi removida".
      //
      // O auth-js roda `_recoverAndRefresh()` em segundo plano ao inicializar,
      // sobre a sessão ANTIGA do localStorage. Se ela estiver inválida ele
      // chama `_removeSession()`, que emite SIGNED_OUT — e esse evento pode
      // chegar DEPOIS de um login novo ter dado certo.
      //
      // Era exatamente o bug do login que não redirecionava: `signIn` gravava o
      // cookie, mostrava "Login realizado com sucesso" e chamava
      // `router.push("/")`; o eco da sessão anterior então destruía o cookie
      // recém-criado e fazia `router.replace("/login")`, que atropelava o push.
      // De fora parecia que o login não tinha funcionado — mas tinha.
      //
      // `getSession` lê do storage, não vai à rede. Se há sessão válida agora,
      // este SIGNED_OUT é passado e não tem o que reconciliar.
      //
      // Reentrância conhecida e inofensiva: quando a sessão guardada é
      // inválida, o próprio `getSession` chama `_removeSession()` e emite um
      // SEGUNDO SIGNED_OUT. Ele reentra aqui uma vez, encontra o storage já
      // vazio e refaz um encerramento idempotente (destruir cookie e
      // `replace` para uma tela onde já se está). Termina em um passo — não é
      // laço —, mas quem for mexer aqui precisa saber que existe.
      const { data } = await supabase.auth.getSession()
      if (data.session) return

      destroyCookie(null, "authData", { path: "/" })
      authStore.clearAuth()
      set_user(USUARIO_VAZIO)
      queryClient.clear()
      router.replace("/login")
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  function getAuthToken(): AuthToken | null {
    const cookies = parseCookies()
    const authData = cookies.authData

    if (authData) {
      try {
        const parsedToken = JSON.parse(authData) as Partial<AuthToken>
        // O cookie vive 7 dias. Quem já estava logado quando `role` foi
        // introduzido tem um cookie SEM esse campo — sem o default abaixo ele
        // voltaria `undefined`, a sidebar ficaria sem itens e o middleware
        // rotearia para lugar nenhum. Owner é o padrão porque era o único papel
        // que existia quando aquele cookie foi gravado.
        return {
          user_id: parsedToken.user_id ?? "",
          company_id: parsedToken.company_id ?? "",
          hashed_password: parsedToken.hashed_password ?? "",
          role: parsedToken.role === "professional" ? "professional" : "owner",
        }
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
    // Ligada logo antes de sair da página. O `finally` abaixo NÃO pode devolver
    // o botão para "Entrar" durante a navegação: o documento novo leva um
    // instante para pintar, e nesse intervalo a tela de login voltaria a
    // parecer ociosa — exatamente a impressão de "não aconteceu nada" que o
    // bug antigo dava.
    let redirecionando = false

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

      // O `role` já vinha do select acima desde sempre e era descartado. Ele
      // decide para qual área o usuário é levado — e SÓ isso. Normalizamos aqui
      // em vez de confiar no texto do banco: o CHECK de 0018 já garante o
      // domínio, mas um valor inesperado não deve virar uma rota inexistente.
      const role: AppRole =
        myiaUser.role === "professional" ? "professional" : "owner"

      const authData: AuthToken = {
        company_id: myiaUser.company_id,
        user_id: sessionData.user.id,
        hashed_password: "",
        role,
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
      authStore.setAuth(authData)

      set_user(authData) // Atualizar o usuário no estado local também
      
      // Carregar dados da empresa diretamente após o login.
      //
      // ⚠️ Desde que o redirecionamento virou navegação de documento (abaixo),
      // este aquecimento não sobrevive à troca de página: o QueryClient é
      // criado no layout raiz e não é persistido, então o cache morre junto
      // com o contexto antigo. Ficou aqui porque não custa nada e volta a
      // valer se o destino um dia voltar a ser navegação de cliente — mas
      // quem for otimizar o tempo de abertura do painel precisa saber que
      // hoje ele NÃO ajuda.
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

      // Cada papel vai para a sua casa. "/" é o painel do dono da clínica
      // ("Piloto Automático" no menu); "/pro" é a área do médico, com sidebar
      // própria de três itens. NÃO usar "/dashboard": aquela rota é uma página
      // legada órfã, fora do DashboardLayout e com dados fictícios.
      const destino = role === "professional" ? "/pro" : "/"

      // NAVEGAÇÃO DE DOCUMENTO, e não `router.push`. Isto conserta o sintoma
      // reincidente de "entrei e continuei na tela de login; só sai com F5".
      //
      // `router.push` é navegação de CLIENTE: continua na mesma página, no
      // mesmo contexto de JavaScript, e por isso pode ser desfeita por
      // qualquer coisa que ainda esteja rodando ali — o eco de SIGNED_OUT da
      // sessão anterior (ver o handler acima), uma entrada de rota já em
      // cache, ou uma transição do React que fica pendente e segura a URL.
      // Cada uma dessas causas foi consertada em separado e o sintoma voltou,
      // porque bastava UMA delas para reaparecer.
      //
      // A troca ataca a classe inteira em vez de mais uma causa: ao trocar o
      // documento, o contexto antigo deixa de existir e nada que ele tenha
      // agendado pode mais atropelar o destino. O middleware roda de novo no
      // servidor, agora enxergando o cookie recém-gravado, e leva cada papel
      // para a sua área. É, literalmente, o F5 que a pessoa dava na mão.
      //
      // `replace` e não `assign`: a tela de login não é um passo do histórico
      // para o qual faça sentido voltar — o "voltar" do navegador cairia em
      // /login, que o middleware devolve para cá.
      //
      // Custa um carregamento inteiro, uma vez por login. Em troca, a
      // identidade nova estreia com a árvore do React limpa e o cache do React
      // Query vazio — num produto clínico, nenhum resquício do usuário
      // anterior atravessa a fronteira.
      if (typeof window !== "undefined") {
        redirecionando = true
        window.location.replace(destino)
      } else {
        router.push(destino)
      }
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
      if (!redirecionando) setIsLoading(false)
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
      set_user(USUARIO_VAZIO)

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
