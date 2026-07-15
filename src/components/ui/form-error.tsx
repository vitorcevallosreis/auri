"use client"

import { XCircle } from "lucide-react"

interface FormErrorProps {
  message: string;
}

export function FormError({ message }: FormErrorProps) {
  if (!message) return null

  return (
    <div className="text-sm text-destructive flex items-center gap-2 mt-1">
      <XCircle className="h-4 w-4" />
      <span>{message}</span>
    </div>
  )
}