import { MiddlewareConfig, NextRequest, NextResponse } from "next/server"

const public_routes = [
  { path: "/login", whenAuthenticated: "redirect" },
  { path: "/register", whenAuthenticated: "redirect" },
  { path: "/reset_password", whenAuthenticated: "redirect" },
  { path: "/pricing", whenAuthenticated: "next" },
] as const

const REDIRECT_WHEN_NOT_AUTHENTICATED_ROUTE = "/login"

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  const publicRoutes = public_routes.find((route) => route.path === path)
  const authToken = request.cookies.get("authData")

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

    // "/" é o painel real (dentro do (private)/layout, com sidebar). A rota
    // "/dashboard" é uma página legada órfã — mandar para lá deixava o usuário
    // numa tela sem menu e com dados fictícios.
    redirect_url.pathname = "/"

    return NextResponse.redirect(redirect_url)
  }

  if (authToken && !publicRoutes) {
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
