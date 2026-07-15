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

  // DESENVOLVIMENTO: Bypass de autenticação para desenvolvimento
  if (process.env.NODE_ENV === "development") {
    // Se não há token de auth, criar um fake para desenvolvimento
    if (!authToken && !publicRoutes) {
      const response = NextResponse.next()
      // Criar um token fake para desenvolvimento
      const fakeAuthData = {
        company_id: "dev-company-id",
        user_id: "dev-user-id",
        hashed_password: "dev-password"
      }
      response.cookies.set("authData", JSON.stringify(fakeAuthData), {
        path: "/",
        maxAge: 60 * 60 * 24,
        httpOnly: false
      })
      return response
    }
  }

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

    redirect_url.pathname = "/dashboard"

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
