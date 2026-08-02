import type { Metadata } from "next"

// Route group da área do profissional. Existe só para o layout e o metadata —
// a URL vem de `pro/`, não daqui.
//
// NÃO criar um `page.tsx` neste grupo: já existem dois arquivos resolvendo "/"
// (src/app/page.tsx, que vence, e src/app/(private)/page.tsx, sombreada), e um
// terceiro faria o build falhar com conflito de rotas paralelas.
//
// `force-dynamic` pela mesma razão documentada em (private)/layout.tsx: a árvore
// depende de contexts client-side do Supabase e o prerender estático quebra.
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Auri · Profissional",
  description: "Sua agenda, seus prontuários e seus atendimentos.",
}

export default function ProfessionalRouteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
