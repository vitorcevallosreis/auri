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
  Building2,
  TabletSmartphone,
  Contact,
  Stethoscope,
  Boxes,
  Tag,
  Handshake,
  CalendarHeart,
  UserRound,
  Settings,
  Store,
  UserCheck,
  ClipboardList,
} from "lucide-react"
import { AuthContext } from "@/contexts/Auth"

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

// Menu principal da clínica no piloto automático
const mainMenuItems: MenuItem[] = [
  { title: "Piloto Automático", icon: <Activity />, route: "/" },
  { title: "Agenda Inteligente", icon: <CalendarHeart />, route: "/appointments" },
  { title: "WhatsApp IA", icon: <Stethoscope />, route: "/chats" },
  { title: "Agentes IA", icon: <Bot />, route: "/assistants", highlight: true },
  { title: "Gestão Financeira", icon: <ClipboardList />, route: "/billing" },
  { title: "Gestão Clínica", icon: <Building2 />, route: "/company" },
  { title: "Base de Pacientes", icon: <UserCheck />, route: "/contacts" },
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
        variant={isActive ? "secondary" : "ghost"}
        className={cn(
          "w-full justify-start gap-4 px-2 py-4",
          isCollapsed && "justify-center px-2",
          highlight && "bg-primary/10 hover:bg-primary/20"
        )}
        onClick={onClick}
      >
        <div className="flex items-center gap-4">
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
          href="/dashboard"
          className={cn(
            "flex items-center gap-2",
            isCollapsed && "justify-center"
          )}
        >
          <Bot className="h-6 w-6 text-[#00897B]" />
          {!isCollapsed && <span className="font-bold text-lg text-[#00897B]">Nexa</span>}
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

      <ScrollArea className="h-[calc(100vh-3rem)] px-2 py-4">
        <TooltipProvider delayDuration={0}>
          <div className="flex flex-col h-full justify-between">
<nav className="flex flex-col gap-1">
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

            {/* Menu sistema - parte inferior */}
            <div>
              {/* Divider */}
              {!isCollapsed && <div className="border-t border-gray-200 my-2" />}
              <div className="flex flex-col gap-0.5 mt-1">
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
                  icon={<DoorClosed className="h-4 w-4 text-gray-400" />}
                  route="#"
                  isCollapsed={isCollapsed}
                  isActive={false}
                  onClick={singOut}
                />
              </div>
            </div>
          </div>
        </TooltipProvider>
      </ScrollArea>
    </aside>
  )
}
