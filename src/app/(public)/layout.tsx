import type { Metadata } from "next"
import type { ReactNode } from "react"

// As rotas públicas (login, cadastro, recuperação de senha) não passam pelo
// (private)/layout, então precisam do próprio metadata — senão a aba dessas
// telas fica sem título. O layout raiz é "use client" e não pode exportá-lo.
export const metadata: Metadata = {
  title: "Auri",
  description: "Motor de Saúde e Bem Estar",
}

export default function PublicLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
