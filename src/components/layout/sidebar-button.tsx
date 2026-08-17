"use client"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

// Botão de navegação lateral, compartilhado entre a sidebar do owner
// (src/app/layout/sidebar.tsx) e a do profissional
// (src/app/layout/professional-sidebar.tsx).
//
// Extraído daqui para lá sem alterar um caractere das classes: as medidas abaixo
// foram calibradas medindo na tela, e duplicá-las em dois arquivos garantiria que
// a próxima calibragem dessincronizasse em silêncio.

export interface SidebarButtonProps {
  title: string;
  icon: React.ReactNode;
  route: string;
  isCollapsed: boolean;
  isActive: boolean;
  onClick: () => void;
  highlight?: boolean;
}

export const SidebarButton = ({
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
