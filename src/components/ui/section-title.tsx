"use client"

import React from "react"
import { cn } from "@/lib/utils"

interface SectionTitleProps {
  children: React.ReactNode
  className?: string
  icon?: React.ReactNode
}

export function SectionTitle({ children, className, icon }: SectionTitleProps) {
  return (
    <div className={cn("bg-muted p-2 mb-4 text-foreground font-medium rounded flex items-center gap-2", className)}>
      {icon && <span>{icon}</span>}
      {children}
    </div>
  )
}

export function SubsectionTitle({ children, className }: SectionTitleProps) {
  return (
    <div className={cn("text-xl text-foreground font-medium mb-2", className)}>
      {children}
    </div>
  )
}
