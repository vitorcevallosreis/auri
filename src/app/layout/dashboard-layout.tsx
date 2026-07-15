"use client"

import { useState, useEffect } from "react"
import { Sidebar } from "./sidebar"
import { cn } from "@/lib/utils"
import { usePathname } from "next/navigation"
import { PageBreadcrumb } from "@/components/layout/page-breadcrumb"
import { CompanyDataLoader } from "@/components/CompanyDataLoader"

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isChatLayout, setIsChatLayout] = useState(false)
  const pathname = usePathname()

  // Detecta viewport mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024)
      if (window.innerWidth < 1024) {
        setIsCollapsed(true)
      }
    }

    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  useEffect(() => {
    setIsChatLayout(pathname === "/chats")
  }, [pathname])

  return (
    <div className="bg-background min-h-screen flex flex-col flex-1 w-full">
      {/* Este componente carrega os dados da empresa automaticamente */}
      <CompanyDataLoader />
      
      <Sidebar
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
        <div className="flex flex-col flex-1">
          {isChatLayout ? (
            <main className="h-screen overflow-hidden">
              <div className="h-full min-h-0">{children}</div>
            </main>
          ) : (
            <main className="p-5">
              {/* Breadcrumb adicionado apenas para layouts que não são de chat */}
              <PageBreadcrumb />
              {children}
            </main>
          )}
        </div>
      </div>
    </div>
  )
}
