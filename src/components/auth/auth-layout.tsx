"use client"

import { Card } from "@/components/ui/card"
import { Bot } from "lucide-react"
import Link from "next/link"

interface AuthLayoutProps {
  children: React.ReactNode
  title: string
  subtitle: string
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-secondary p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link href="/" className="inline-block">
            <div className="flex items-center justify-center gap-2 text-primary mb-2">
              <Bot className="h-8 w-8" />
              <span className="text-2xl font-bold">Nexa</span>
            </div>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground mt-2">{subtitle}</p>
        </div>

        <Card className="p-6">{children}</Card>
      </div>
    </div>
  )
}
