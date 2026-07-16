import type { ReactNode } from "react"

// A árvore privada depende de contexts client-side (Supabase/auth) que não podem
// ser resolvidos em build time. Forçar renderização dinâmica evita o prerender
// estático de `/(private)/page` (a home `/`), que quebrava `next build` com
// `TypeError: Cannot read properties of undefined (reading 'entryCSSFiles')`.
// Ref: docs/superpowers/plans/2026-07-15-plano2-evolution-ingress.md (P2.0).
export const dynamic = "force-dynamic"

export default function PrivateLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
