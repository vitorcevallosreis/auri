"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useContext } from "react"
import { useTheme } from "next-themes"
import { ThemeToggleIcon } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import {
  Bot,
  ChevronLeft,
  ChevronRight,
  DoorClosed,
  Activity,
  CalendarDays,
  MessageSquare,
  DollarSign,
  Building,
  BookUser,
  Settings,
} from "lucide-react"
import { AuthContext } from "@/contexts/Auth"
import { AuriIcon, AuriLogo } from "@/components/brand/auri-logo"

interface SidebarProps {
  isCollapsed: boolean
  setIsCollapsed: (collapsed: boolean) => void
  isMobile: boolean
}

interface MenuItem {
  title: string
  icon: React.ReactNode
  route: string
  highlight?: boolean
}

// Menu principal da clínica no piloto automático.
//
// Ícones escolhidos pelo Vitor a partir de uma grade comparativa renderizada no
// tamanho real. Mudanças em relação ao conjunto original:
//   · Agenda     CalendarHeart -> CalendarDays  (o coração era ornamento)
//   · WhatsApp   Stethoscope   -> MessageSquare (o estetoscópio estava na linha errada)
//   · Financeiro ClipboardList -> DollarSign    (prancheta é registro, não dinheiro)
//   · Clínica    Building2     -> Building      (mesma ideia, desenho mais limpo)
//   · Pacientes  UserCheck     -> BookUser      ("check" sugeria aprovação; aqui é cadastro)
const mainMenuItems: MenuItem[] = [
  { title: "Piloto Automático", icon: <Activity />, route: "/" },
  { title: "Agenda Inteligente", icon: <CalendarDays />, route: "/appointments" },
  { title: "WhatsApp IA", icon: <MessageSquare />, route: "/chats" },
  { title: "Agentes IA", icon: <Bot />, route: "/assistants", highlight: true },
  { title: "Gestão Financeira", icon: <DollarSign />, route: "/billing" },
  { title: "Gestão Clínica", icon: <Building />, route: "/company" },
  { title: "Base de Pacientes", icon: <BookUser />, route: "/contacts" },
]

// Menu de configurações e sistema
const systemMenuItems: MenuItem[] = [
  { title: "Configurações", icon: <Settings />, route: "/settings" },
]

interface SidebarButtonProps {
  title: string;
  icon: React.ReactNode;
  route: string;
  isCollapsed: boolean;
  isActive: boolean;
  onClick: () => void;
  highlight?: boolean;
}

const SidebarButton = ({
  title,
  icon,
  route,
  isCollapsed,
  isActive,
  onClick,
  highlight = false,
}: SidebarButtonProps) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        variant="ghost"
        className={cn(
          // Escala da navegação, medida e reduzida deliberadamente:
          //   texto 14 -> 13px · ícone 24 -> 18px · traço 2 -> 1,75 · gap 16 -> 12px
          //   altura 40 -> 36px, mantendo os 8px entre itens.
          // O peso vinha sobretudo do ícone: ele nunca recebeu classe de tamanho
          // e ficava nos 24px padrão do lucide, grande demais ao lado de 13-14px.
          // O `py-4` que existia aqui era inerte — a altura fixa do Button vencia,
          // e a caixa de conteúdo resultante (8px) era menor que o próprio ícone.
          "relative h-9 w-full justify-start gap-3 px-2 text-[13px]",
          "[&_svg]:h-[18px] [&_svg]:w-[18px] [&_svg]:stroke-[1.75]",
          isCollapsed && "justify-center px-2",
          // Item em destaque (menta bem diluído, para não competir com o ativo)
          highlight && !isActive && "bg-accent/15 hover:bg-accent/25",
          // Estado ativo: o menta da marca entra como FUNDO tingido com texto
          // petróleo por cima. Menta como cor de texto/traço em fundo claro dá
          // 1,6:1 e some — por isso ele é fundo, nunca traço.
          isActive && [
            // text-foreground, NÃO text-primary: no tema escuro o --primary é o
            // próprio menta, o que deixaria texto menta sobre fundo menta (1:1).
            // O foreground inverte com o tema e funciona nos dois.
            "bg-accent/25 hover:bg-accent/35 font-medium text-foreground",
            // Barra sólida à esquerda: aqui o menta pode ser cheio, por ser
            // elemento decorativo (não carrega texto).
            "before:absolute before:left-0 before:top-1/2 before:h-6 before:w-1",
            "before:-translate-y-1/2 before:rounded-r before:bg-accent",
          ]
        )}
        onClick={onClick}
      >
        <div className="flex items-center gap-3">
          {icon}
          {!isCollapsed && <span>{title}</span>}
        </div>
      </Button>
    </TooltipTrigger>
    {isCollapsed && (
      <TooltipContent side="right" className="ml-1">
        {title}
      </TooltipContent>
    )}
  </Tooltip>
)

export function Sidebar({
  isCollapsed,
  setIsCollapsed,
  isMobile,
}: SidebarProps) {
  const { singOut } = useContext(AuthContext)
  const { theme, setTheme } = useTheme()
  const pathname = usePathname()
  const router = useRouter()

  const handleNavigation = (route: string) => router.push(route)

  // Função para verificar se uma rota está ativa, considerando subrotas
  const isRouteActive = (route: string): boolean => {
    // Para a página inicial, só é ativa se for exatamente "/"
    if (route === "/") {
      return pathname === "/"
    }
    
    // Para o Chat, só destaca se estiver exatamente em /chats
    if (route === "/chats") {
      return pathname === "/chats" || pathname.startsWith("/chats/")
    }
    
    // Para outras rotas, verifica se o pathname começa com a rota
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
          href="/"
          className={cn(
            "flex items-center gap-2",
            isCollapsed && "justify-center"
          )}
        >
          {/* O lockup já contém o wordmark "Auri"; recolhido, só o símbolo. */}
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
          {isMobile ? (
            <ChevronRight className="h-4 w-4" />
          ) : isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* O grupo de sistema fica FORA do ScrollArea, ancorado no rodapé. Dentro
          dele não funcionaria: o Radix envolve o conteúdo num wrapper com
          `display: table`, que interrompe a cadeia de altura e faz qualquer
          `h-full`/`justify-between` interno colapsar para a altura do conteúdo. */}
      <div className="flex h-[calc(100vh-3rem)] flex-col">
        <TooltipProvider delayDuration={0}>
          <ScrollArea className="flex-1 px-2 py-4">
            <nav className="flex flex-col gap-2">
              {mainMenuItems.map((item: MenuItem) => (
                <SidebarButton
                  key={item.route}
                  title={item.title}
                  icon={item.icon}
                  route={item.route}
                  isCollapsed={isCollapsed}
                  isActive={isRouteActive(item.route)}
                  onClick={() => handleNavigation(item.route)}
                  highlight={item.highlight}
                />
              ))}
            </nav>
          </ScrollArea>

          {/* Menu sistema - parte inferior */}
          <div className="shrink-0 px-2 pb-4">
            {/* Divider */}
            {!isCollapsed && <div className="border-t border-border mb-2" />}
            <div className="flex flex-col gap-0.5">
              {/* Configurações */}
              {systemMenuItems.map((item: MenuItem) => (
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

              {/* Tema */}
              <SidebarButton
                title="Tema"
                icon={<ThemeToggleIcon />}
                route="#"
                isCollapsed={isCollapsed}
                isActive={false}
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              />

              {/* Sair */}
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
