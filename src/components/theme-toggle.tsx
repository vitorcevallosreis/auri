"use client"

import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { Moon, Sun } from "lucide-react"

export function ThemeToggleIcon() {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Only show the theme toggle icon after mounting to avoid hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    // Return a placeholder with the same dimensions during SSR
    return <div className="h-5 w-5" />
  }

  return theme === "dark" ? (
    <Sun className="h-5 w-5" />
  ) : (
    <Moon className="h-5 w-5" />
  )
}
