"use client"

import "./globals.css"

import { Poppins } from "next/font/google"
import GlobalContext from "@/contexts/GlobalContext"
import { ThemeProvider } from "@/components/theme-provider"

import { NextUIProvider } from "@nextui-org/react"
import { Toaster } from "sonner"
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const poppins = Poppins({
  weight: "400",
  subsets: ["latin"],
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
          <body className={`${poppins.className} min-h-screen flex flex-col`}>
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
