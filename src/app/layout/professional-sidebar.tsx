"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useContext } from "react"
import { useTheme } from "next-themes"
import { ThemeToggleIcon } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import {
  ChevronLeft,
  ChevronRight,
  DoorClosed,
  Sun,
  ClipboardList,
  Wallet,
} from "lucide-react"
import { AuthContext } from "@/contexts/Auth"
import { AuriIcon, AuriLogo } from "@/components/brand/auri-logo"
import { SidebarButton } from "@/components/layout/sidebar-button"

interface ProfessionalSidebarProps {
  isCollapsed: boolean
  setIsCollapsed: (collapsed: boolean) => void
  isMobile: boolean
}

interface MenuItem {
  title: string
  icon: React.ReactNode
  route: string
}

// Três itens, e só. O médico não gere a clínica: não há configurações, agentes,
// WhatsApp, catálogo nem base de pacientes.
//
// `ClipboardList` foi recusado no menu do dono com o argumento "prancheta é
// registro, não dinheiro" — o que a torna exatamente certa para prontuário.
// `Wallet` em vez de `DollarSign` porque aqui o assunto é o dinheiro DELE, não
// o caixa da clínica.
const menuItems: MenuItem[] = [
  { title: "Meu Dia", icon: <Sun />, route: "/pro" },
  { title: "Prontuário", icon: <ClipboardList />, route: "/pro/prontuario" },
  { title: "Meu Financeiro", icon: <Wallet />, route: "/pro/financeiro" },
]

export function ProfessionalSidebar({
  isCollapsed,
  setIsCollapsed,
  isMobile,
}: ProfessionalSidebarProps) {
  const { singOut } = useContext(AuthContext)
  const { theme, setTheme } = useTheme()
  const pathname = usePathname()
  const router = useRouter()

  const handleNavigation = (route: string) => router.push(route)

  const isRouteActive = (route: string): boolean => {
    // "/pro" precisa de igualdade exata. Com `startsWith`, estar em
    // /pro/prontuario acenderia "Meu Dia" E "Prontuário" ao mesmo tempo — o
    // mesmo cuidado que a sidebar do dono toma com "/".
    if (route === "/pro") return pathname === "/pro"
    return pathname.startsWith(route)
  }

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen border-r bg-background transition-all duration-300",
        isCollapsed ? "w-[60px]" : "w-[240px]",
        isMobile && isCollapsed && "-translate-x-full",
        "lg:translate-x-0"
      )}
    >
      <div className="flex h-12 items-center justify-between gap-2 border-b px-2">
        <Link
          href="/pro"
          className={cn(
            "flex items-center gap-2",
            isCollapsed && "justify-center"
          )}
        >
          {isCollapsed ? (
            <AuriIcon className="h-6 w-6" />
          ) : (
            <AuriLogo className="h-6 text-foreground" />
          )}
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isMobile || isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Rodapé FORA do ScrollArea, como na sidebar do dono: o Radix envolve o
          conteúdo num wrapper com `display: table`, que interrompe a cadeia de
          altura e faria qualquer `justify-between` interno colapsar. */}
      <div className="flex h-[calc(100vh-3rem)] flex-col">
        <TooltipProvider delayDuration={0}>
          <ScrollArea className="flex-1 px-2 py-4">
            <nav className="flex flex-col gap-2">
              {menuItems.map((item) => (
                <SidebarButton
                  key={item.route}
                  title={item.title}
                  icon={item.icon}
                  route={item.route}
                  isCollapsed={isCollapsed}
                  isActive={isRouteActive(item.route)}
                  onClick={() => handleNavigation(item.route)}
                />
              ))}
            </nav>
          </ScrollArea>

          <div className="shrink-0 px-2 pb-4">
            {!isCollapsed && <div className="border-t border-border mb-2" />}
            <div className="flex flex-col gap-0.5">
              <SidebarButton
                title="Tema"
                icon={<ThemeToggleIcon />}
                route="#"
                isCollapsed={isCollapsed}
                isActive={false}
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              />
              <SidebarButton
                title="Sair"
                icon={<DoorClosed className="h-4 w-4 text-muted-foreground" />}
                route="#"
                isCollapsed={isCollapsed}
                isActive={false}
                onClick={singOut}
              />
            </div>
          </div>
        </TooltipProvider>
      </div>
    </aside>
  )
}
