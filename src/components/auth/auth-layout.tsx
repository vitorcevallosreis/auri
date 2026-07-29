"use client"

import Link from "next/link"
import { AuriLogo } from "@/components/brand/auri-logo"
import { AuriGrafismo } from "@/components/brand/auri-grafismo"

interface AuthLayoutProps {
  children: React.ReactNode
  title: string
  subtitle: string
}

/**
 * Layout das telas de autenticação.
 *
 * Estrutura dividida (formulário + painel de marca), que é o padrão em produtos
 * SaaS premium: o formulário fica com peso visual próprio em vez de flutuar
 * sozinho no meio de uma tela vazia, e o painel dá presença de marca no
 * primeiro contato — que antes se resumia a um logo pequeno no topo.
 *
 * O painel some abaixo de `lg`: em telas pequenas o formulário ocupa tudo, sem
 * empurrar o conteúdo para baixo da dobra.
 *
 * As frases são as da própria plataforma de marca (p50 do manual).
 */
export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen">
      {/* Formulário */}
      <div className="flex w-full flex-col justify-center px-6 py-12 lg:w-1/2 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <Link href="/" className="inline-block">
            <AuriLogo className="h-9 text-foreground" />
          </Link>

          <div className="mt-10">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {title}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
          </div>

          <div className="mt-8">{children}</div>
        </div>
      </div>

      {/* Painel de marca — decorativo, escondido em telas menores */}
      <div className="relative hidden overflow-hidden bg-brand lg:flex lg:w-1/2 lg:flex-col lg:justify-end">
        {/* Um único grafismo, ancorado nas bordas superiores do painel: o
            manual pede que as quinas do "A" formem ângulos harmoniosos com o
            limite da arte, o que não acontece quando ele é cortado num canto
            qualquer. Largura total = as duas asas nascem das quinas de cima. */}
        <AuriGrafismo
          className="absolute left-0 top-0 w-full text-accent"
          opacity={0.13}
        />

        <div className="relative z-10 p-16">
          <p className="text-3xl font-semibold leading-tight text-brand-foreground">
            Tecnologia que cuida
            <br />
            de quem cuida da gente.
          </p>
          <p className="mt-4 text-sm text-brand-foreground/70">
            Auri. Motor de Saúde e Bem Estar.
          </p>
        </div>
      </div>
    </div>
  )
}
