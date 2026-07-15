"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuthStore } from "@/lib/auth-store"

const publicPaths = ["/", "/login", "/register", "/reset_password"]

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const isPublicPath = publicPaths.includes(pathname)

    if (!isAuthenticated && !isPublicPath) {
      router.push("/login")
    } else if (isAuthenticated && pathname === "/login") {
      router.push("/dashboard")
    }
  }, [isAuthenticated, pathname, router])

  return <>{children}</>
}
