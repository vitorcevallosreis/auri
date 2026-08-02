"use client"

import React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Home } from "lucide-react"
import { useContext } from "react"
import { AssistantsContext } from "@/contexts/Assistants"

type BreadcrumbItem = {
  label: string
  href: string
  isCurrentPage?: boolean
}

// Mapeamento de rótulos para paths
const pathToLabel: Record<string, string> = {
  "dashboard": "Dashboard",
  "chats": "Chats",
  "assistants": "Assistentes",
  "appointments": "Central de Agendamentos",
  "company": "Empresa",
  "professionals": "Profissionais",
  "categories": "Categorias",
  "products": "Produtos",
  "services": "Serviços",
  "contacts": "Pacientes",
  "settings": "Configurações",
  "devices": "Meus Dispositivos",
  "preferences": "Preferências",
  "security": "Segurança",
  "profile": "Perfil",
  "notifications": "Notificações",
  // Sem entrada aqui o breadcrumb mostra o slug cru em inglês. "billing" já
  // faltava desde antes; as três seguintes são da área do profissional.
  "billing": "Gestão Financeira",
  "pro": "Meu Dia",
  "prontuario": "Prontuário",
  "financeiro": "Meu Financeiro",
}

// Definindo relações hierárquicas - quais páginas são filhas de quais
const pageHierarchy: Record<string, { parent: string, label: string }> = {
  "professionals": { parent: "company", label: "Profissionais" },
  "categories": { parent: "company", label: "Categorias" },
  "products": { parent: "company", label: "Produtos" },
  "services": { parent: "company", label: "Serviços" },
  "devices": { parent: "settings", label: "Meus Dispositivos" },
  "preferences": { parent: "settings", label: "Preferências" },
  "security": { parent: "settings", label: "Segurança" },
  "profile": { parent: "settings", label: "Perfil" },
  "notifications": { parent: "settings", label: "Notificações" },
}

export const getChildPageName = (pathname: string): string => {
  // Pega o último segmento do caminho
  const segments = pathname.split("/").filter(segment => segment && segment !== "(private)")
  const lastSegment = segments[segments.length - 1]
  
  // Verifica se é um ID dinâmico (começa com [ e termina com ])
  if (lastSegment && lastSegment.startsWith("[") && lastSegment.endsWith("]")) {
    // Se for um ID, use o penúltimo segmento se disponível
    return segments.length > 1 ? pathToLabel[segments[segments.length - 2]] || segments[segments.length - 2] : "Detalhe"
  }
  
  // Retorna o label correspondente ou o próprio segmento
  return pathToLabel[lastSegment] || lastSegment
}

export function PageBreadcrumb() {
  const pathname = usePathname()
  const { assistant } = useContext(AssistantsContext)

  // Ignora rotas privadas para simplificação
  const cleanPath = pathname.replace("/(private)", "")
  
  // Divide o caminho em segmentos e filtra segmentos vazios
  const segments = cleanPath.split("/").filter(segment => segment && segment !== "(private)")
  
  // Se não houver segmentos, estamos na página inicial
  if (segments.length === 0) {
    return null
  }

  // Criar breadcrumb items com hierarquia lógica (não apenas baseado no URL)
  const breadcrumbItems: BreadcrumbItem[] = []
  
  // Processa cada segmento do URL
  segments.forEach((segment, index) => {
    // Verifica se o segmento atual tem uma relação hierárquica definida
    const hierarchyInfo = pageHierarchy[segment]
    
    // Se tiver uma relação hierárquica e o parent não estiver já no caminho
    if (hierarchyInfo && !segments.includes(hierarchyInfo.parent)) {
      // Adicione o parent antes
      breadcrumbItems.push({
        label: pathToLabel[hierarchyInfo.parent] || hierarchyInfo.parent,
        href: `/${hierarchyInfo.parent}`,
        isCurrentPage: false
      })
    }
    
    // Constrói o caminho atual para este item
    const href = `/${segments.slice(0, index + 1).join("/")}`
    
    // Verifica se é o último item (página atual)
    const isCurrentPage = index === segments.length - 1
    
    // Verifique se é uma rota dinâmica (com [param])
    const isDynamic = segment.startsWith("[") && segment.endsWith("]")
    
    // Seleciona o label apropriado
    let label = isDynamic ? "Detalhe" : (pathToLabel[segment] || segment)
    if (segments[0] === "assistants" && segments.length > 1 && index === 1) {
      // Quando estamos em /assistants/{id}, utilizar o nome do assistente caso esteja disponível
      label = assistant?.name || "Assistente"
    }
    
    breadcrumbItems.push({
      label,
      href,
      isCurrentPage,
    })
  })

  return (
    <Breadcrumb className="mb-4">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/">
              <Home className="h-4 w-4" />
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        
        {breadcrumbItems.map((item, index) => (
          <React.Fragment key={`${item.href}-${index}`}>
            <BreadcrumbItem>
              {item.isCurrentPage ? (
                <BreadcrumbPage>{item.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link href={item.href}>{item.label}</Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
            {index < breadcrumbItems.length - 1 && <BreadcrumbSeparator />}
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
