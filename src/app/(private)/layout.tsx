import type { Metadata } from "next"
import type { ReactNode } from "react"

// A árvore privada depende de contexts client-side (Supabase/auth) que não podem
// ser resolvidos em build time. Forçar renderização dinâmica evita o prerender
// estático de `/(private)/page` (a home `/`), que quebrava `next build` com
// `TypeError: Cannot read properties of undefined (reading 'entryCSSFiles')`.
// Ref: docs/superpowers/plans/2026-07-15-plano2-evolution-ingress.md (P2.0).
export const dynamic = "force-dynamic"

// O layout raiz é "use client" e por isso não pode exportar metadata. Este
// layout é server component, então é aqui que o título da aba é definido.
export const metadata: Metadata = {
  title: "Auri",
  description: "Motor de Saúde e Bem Estar",
}

export default function PrivateLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
