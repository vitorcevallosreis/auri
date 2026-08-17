import { cn } from "@/lib/utils"

/**
 * Logotipo e ícone da Auri, inline em SVG.
 *
 * Por que inline em vez de <img src="/logo.svg">: o wordmark precisa acompanhar
 * o tema (petróleo no claro, claro no escuro). Com o SVG inline ele usa
 * `currentColor` e herda a cor do texto — um só arquivo serve aos dois temas,
 * sem duplicar assets nem piscar na troca.
 *
 * O símbolo mantém o menta da marca fixo (é a cor de destaque, não deve variar).
 * A opacidade .8 vem do arquivo original da marca e foi preservada.
 *
 * Fonte: "Logotipo e Assets Visuais/Logotipo/Logotipo Auri/SVG/
 *         Logotipo Principal Verde e Escuro.svg" e Ícone Principal.
 */

const MENTA = "#68E2A5"

/** Só o símbolo (o "A" em duas asas). Use quando não houver espaço p/ o wordmark. */
export function AuriIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 342.21 255.81"
      role="img"
      aria-label="Auri"
      className={cn("h-6 w-auto", className)}
    >
      <g fill={MENTA}>
        <path opacity={0.8} d="M342.21,137.2v118.61S124.03,226.12,87.96,0h166.37s.63,92.1,87.89,137.2Z" />
        <path opacity={0.8} d="M0,137.2v118.61S218.19,226.12,254.25,0H87.89s-.63,92.1-87.89,137.2Z" />
      </g>
    </svg>
  )
}

/** Lockup completo: símbolo + wordmark "Auri". */
export function AuriLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 865.74 255.81"
      role="img"
      aria-label="Auri"
      className={cn("h-6 w-auto", className)}
    >
      {/* Wordmark — herda a cor do texto, então funciona nos dois temas */}
      <g fill="currentColor">
        <path d="M444.88,40.1h58.4l58.16,166.17h-47.24l-8.07-24.92h-64.09l-8.07,24.92h-47.24l58.16-166.17ZM495.68,148.34l-20.42-63.14h-2.37l-20.41,63.14h43.2Z" />
        <path d="M630.51,172.56c10.21,0,19.7-5.22,19.7-21.13v-68.6h43.92v123.44h-43.92v-26.59h-1.9c-2.37,13.29-14.24,28.96-37.51,28.96s-41.54-16.62-41.54-46.29v-79.52h43.92v68.6c0,15.9,7.36,21.13,17.33,21.13Z" />
        <path d="M717.38,82.83h43.92v31.33h.95c4.98-21.13,16.62-32.76,33.95-32.76,2.61,0,5.7.24,9.5,1.19v36.79c-4.04-.47-6.88-.71-9.97-.71-14.96,0-34.42,6.88-34.42,39.17v48.43h-43.92v-123.44Z" />
        <path d="M819.45,51.02c0-13.29,10.92-23.26,23.03-23.26s23.26,9.97,23.26,23.26-10.92,23.03-23.26,23.03-23.03-9.73-23.03-23.03ZM820.64,82.83h43.92v123.44h-43.92v-123.44Z" />
      </g>
      {/* Símbolo — menta fixo da marca */}
      <g fill={MENTA}>
        <path opacity={0.8} d="M342.21,137.2v118.61S124.03,226.12,87.96,0h166.37s.63,92.1,87.89,137.2Z" />
        <path opacity={0.8} d="M0,137.2v118.61S218.19,226.12,254.25,0H87.89s-.63,92.1-87.89,137.2Z" />
      </g>
    </svg>
  )
}
