"use client"

import { AlertTriangle, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface ErrorProps {
  title?: string;
  message: string;
  variant?: "warning" | "error";
  className?: string;
}

export function Error({ 
  title, 
  message, 
  variant = "error",
  className 
}: ErrorProps) {
  const Icon = variant === "error" ? XCircle : AlertTriangle
  const baseStyles = "rounded-lg p-4 text-sm flex items-start gap-3"
  const variantStyles = variant === "error" 
    ? "bg-destructive/10 text-destructive" 
    : "bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-300"

  return (
    <div className={cn(baseStyles, variantStyles, className)}>
      <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
      <div>
        {title && <h4 className="font-medium mb-1">{title}</h4>}
        <p>{message}</p>
      </div>
    </div>
  )
}