"use client"

import "./globals.css"

import { Hanken_Grotesk } from "next/font/google"
import GlobalContext from "@/contexts/GlobalContext"
import { ThemeProvider } from "@/components/theme-provider"

import { NextUIProvider } from "@nextui-org/react"
import { Toaster } from "sonner"
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Hanken Grotesk — substituta aprovada da Articulat CF da marca (que é
// comercial e exigiria licença de webfont). Grotesca geométrica, no Google
// Fonts sob OFL.
//
// Os 4 pesos correspondem aos da marca: Light / Regular / Demi Bold / Dark.
// Antes daqui só a Poppins 400 era carregada, então TODO texto em 500/700 era
// negrito sintético (faux bold) desenhado pelo navegador — borrado e sem o
// desenho real da fonte. Com os pesos reais isso deixa de acontecer.
const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "600", "700"],
  display: "swap",
  variable: "--font-sans",
})

// Criando um cliente React Query com configurações globais
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Não recarrega quando a janela ganha foco
      retry: 1, // Tenta uma vez se falhar
      staleTime: 5 * 60 * 1000, // Dados são considerados atualizados por 5 minutos
    },
  },
})

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <GlobalContext>
        <html lang="pt-BR" suppressHydrationWarning>
          <body className={`${hankenGrotesk.variable} font-sans min-h-screen flex flex-col`}>
            <NextUIProvider>
              <ThemeProvider
                attribute="class"
                defaultTheme="light"
                enableSystem={false}
                storageKey="myia-ai-theme"
              >
                {children}
                <Toaster richColors expand={true} />
              </ThemeProvider>
            </NextUIProvider>
          </body>
        </html>
      </GlobalContext>
    </QueryClientProvider>
  )
}
