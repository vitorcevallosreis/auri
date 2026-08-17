import { MiddlewareConfig, NextRequest, NextResponse } from "next/server"

const public_routes = [
  { path: "/login", whenAuthenticated: "redirect" },
  { path: "/register", whenAuthenticated: "redirect" },
  { path: "/reset_password", whenAuthenticated: "redirect" },
  { path: "/pricing", whenAuthenticated: "next" },
] as const

const REDIRECT_WHEN_NOT_AUTHENTICATED_ROUTE = "/login"

/** Raiz da área do profissional. Tudo sob ela é do médico; nada fora dela é. */
const PROFESSIONAL_ROOT = "/pro"

/**
 * Lê o papel do cookie `authData`.
 *
 * ESTE VALOR NÃO AUTORIZA NADA. O cookie não é assinado nem httpOnly
 * (src/contexts/Auth/index.tsx grava com `setCookie` do nookies), então qualquer
 * pessoa o edita no devtools. O que ele decide aqui é ROTEAMENTO: levar cada
 * papel para a sua casa em vez de deixar o médico numa tela de gestão vazia.
 *
 * A autorização de verdade é o RLS, que consulta myia_users no banco. Um médico
 * que forjar `role:"owner"` e abrir "/" recebe a página renderizada com TODOS os
 * números zerados e todas as listas vazias — porque app_role() continua
 * devolvendo 'professional'. É o comportamento desejado, e é o teste que prova
 * que a fronteira está no lugar certo.
 */
function readRole(raw: string | undefined): "owner" | "professional" {
  try {
    return JSON.parse(raw ?? "{}").role === "professional" ? "professional" : "owner"
  } catch {
    // Cookie corrompido não pode derrubar o app: trata como owner e deixa o RLS
    // decidir o que ele consegue ver.
    return "owner"
  }
}

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  const publicRoutes = public_routes.find((route) => route.path === path)
  const authToken = request.cookies.get("authData")
  const role = readRole(authToken?.value)
  const homeForRole = role === "professional" ? PROFESSIONAL_ROOT : "/"
  const isProfessionalArea =
    path === PROFESSIONAL_ROOT || path.startsWith(`${PROFESSIONAL_ROOT}/`)

  // NÃO reintroduzir um "bypass de desenvolvimento" aqui.
  //
  // Existia neste ponto um bloco que, em NODE_ENV=development, plantava um
  // cookie `authData` FALSO (company_id "dev-company-id") em quem abrisse
  // qualquer rota privada deslogado. Ele causava três problemas:
  //
  //   1. Depois de plantado, o cookie fazia o próprio middleware tratar a
  //      pessoa como autenticada — e como /login redireciona quem já está
  //      logado, a tela de login ficava INALCANÇÁVEL em dev. Testar o fluxo de
  //      login virava impossível sem limpar cookie na mão.
  //   2. O company_id fake não existe no banco e não vem acompanhado de sessão
  //      do Supabase Auth, então a RLS barrava tudo: o painel abria vazio ou
  //      quebrado, sem erro claro.
  //   3. Era um bypass de autenticação dependendo de uma única variável de
  //      ambiente. Qualquer deploy que subisse sem NODE_ENV=production viraria
  //      um app com login aberto.
  //
  // Em dev o fluxo agora é o mesmo de produção: cai em /login e entra com um
  // usuário real do Supabase.

  if (!authToken && publicRoutes) {
    return NextResponse.next()
  }

  if (!authToken && !publicRoutes) {
    const redirect_url = request.nextUrl.clone()

    redirect_url.pathname = REDIRECT_WHEN_NOT_AUTHENTICATED_ROUTE

    return NextResponse.redirect(redirect_url)
  }

  if (
    authToken &&
    publicRoutes &&
    publicRoutes.whenAuthenticated === "redirect"
  ) {
    const redirect_url = request.nextUrl.clone()

    // "/" é o painel do dono (dentro do (private)/layout, com sidebar) e "/pro"
    // é a área do médico. A rota "/dashboard" é uma página legada órfã — mandar
    // para lá deixava o usuário numa tela sem menu e com dados fictícios.
    redirect_url.pathname = homeForRole

    return NextResponse.redirect(redirect_url)
  }

  if (authToken && !publicRoutes) {
    // Cada papel fica na sua área. Sem isto, o médico que digitasse "/" veria o
    // painel de gestão inteiro renderizado e zerado — tecnicamente seguro, pelo
    // RLS, mas incompreensível como produto.
    if (role === "professional" && !isProfessionalArea) {
      const redirect_url = request.nextUrl.clone()
      redirect_url.pathname = PROFESSIONAL_ROOT
      return NextResponse.redirect(redirect_url)
    }
    if (role !== "professional" && isProfessionalArea) {
      const redirect_url = request.nextUrl.clone()
      redirect_url.pathname = "/"
      return NextResponse.redirect(redirect_url)
    }

    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config: MiddlewareConfig = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
}
