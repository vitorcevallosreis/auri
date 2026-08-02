"use client"

import { useState, useEffect } from "react"
import { ProfessionalSidebar } from "./professional-sidebar"
import { cn } from "@/lib/utils"

// Casca da área do médico. É irmã de dashboard-layout.tsx, com duas ausências
// deliberadas:
//
//   · SEM <CompanyDataLoader/>. Ele dispara seis buscas em tabelas que passaram
//     a ser exclusivas do dono (0019), e o CompanyContext levanta um toast de
//     erro em cada falha — o médico tomaria uma parede de toasts vermelhos a
//     cada navegação, por dados que ele não deveria mesmo enxergar.
//
//   · SEM <PageBreadcrumb/> no topo. São três rotas planas e a direção visual
//     pede respiro; a trilha só aparece no detalhe do prontuário, onde de fato
//     existe um caminho de volta a percorrer.
//
// Os 14 providers do GlobalContext continuam montados (vêm do layout raiz) e
// são seguros: nenhum busca nada no mount, só assinam realtime — e as
// assinaturas simplesmente não entregam nada sob o RLS do profissional.

export function ProfessionalLayout({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024
      setIsMobile(mobile)
      if (mobile) setIsCollapsed(true)
    }
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  return (
    <div className="bg-background min-h-screen flex flex-col flex-1 w-full">
      <ProfessionalSidebar
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        isMobile={isMobile}
      />
      <div
        className={cn(
          "transition-all duration-300",
          isCollapsed ? "lg:ml-[60px]" : "lg:ml-[240px]",
          "ml-0"
        )}
      >
        {/* Respiro maior que o p-5 do painel do dono: estas telas têm poucos
            elementos e a folga é parte do desenho, não sobra. */}
        <main className="mx-auto w-full max-w-6xl px-6 py-10 lg:px-10">
          {children}
        </main>
      </div>
    </div>
  )
}
