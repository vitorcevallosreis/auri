import { cn } from "@/lib/utils"

/**
 * Grafismos da marca Auri — recortes do ícone "A".
 *
 * Regras do manual (Plataforma de Marca, p54) respeitadas aqui:
 *  - São recortes do "A" original, nunca padrões repetidos
 *  - NUNCA girados (o manual só libera 180° ao usar como faca de recorte)
 *  - NUNCA distorcidos: o `viewBox` é preservado e não há
 *    `preserveAspectRatio="none"`, então a forma nunca estica nem comprime
 *  - Variações de opacidade são encorajadas → prop `opacity`
 *  - Devem gerar contraste sem atrapalhar a leitura → por isso são
 *    `aria-hidden` e ficam sempre atrás do conteúdo (`-z-10` no uso)
 *
 * Fonte: "Logotipo e Assets Visuais/Grafismos/{Preenchido,Contorno}/SVG/".
 */

interface GrafismoProps {
  className?: string
  /** Variação de opacidade — o manual encoraja explorá-la. */
  opacity?: number
  variante?: "preenchido" | "contorno"
}

export function AuriGrafismo({
  className,
  opacity = 0.5,
  variante = "preenchido",
}: GrafismoProps) {
  if (variante === "contorno") {
    return (
      <svg
        viewBox="0 0 2094.9 1573.78"
        aria-hidden="true"
        focusable="false"
        className={cn("pointer-events-none select-none", className)}
      >
        <g
          fill="none"
          stroke="currentColor"
          strokeMiterlimit={10}
          strokeWidth={24}
          opacity={opacity}
        >
          <path d="M2082.9,731.53V13.74S762.54,193.41,544.29,1561.78h1006.77s3.82-557.34,531.85-830.25Z" />
          <path d="M12,731.53V13.74s1320.37,179.67,1538.62,1548.04h-1006.77s-3.82-557.34-531.85-830.25Z" />
        </g>
      </svg>
    )
  }

  return (
    <svg
      viewBox="0 0 2070.9 1548.04"
      aria-hidden="true"
      focusable="false"
      className={cn("pointer-events-none select-none", className)}
    >
      <g fill="currentColor" opacity={opacity}>
        <path d="M2070.9,717.79V0S750.54,179.67,532.29,1548.04h1006.77s3.82-557.34,531.85-830.25Z" />
        <path d="M0,717.79V0s1320.37,179.67,1538.62,1548.04h-1006.77S528.03,990.69,0,717.79Z" />
      </g>
    </svg>
  )
}
