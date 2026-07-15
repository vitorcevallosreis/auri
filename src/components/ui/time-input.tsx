"use client"

import React from "react"
import { Input } from "@nextui-org/react"
import { Clock } from "lucide-react"
import { cn } from "@/lib/utils"

interface TimeInputProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  label?: string
  className?: string
}

export function TimeInput({ value, onChange, disabled = false, label, className }: TimeInputProps) {
  return (
    <div className={cn("space-y-1", className)}>
      {label && <label className="text-sm font-medium text-foreground">{label}</label>}
      <div className="flex items-center space-x-2">
        <Clock size={16} className="text-muted-foreground" />
        <Input
          type="time"
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          value={value || ""}
          classNames={{
            input: "text-foreground",
            inputWrapper: "bg-default-100 data-[hover=true]:bg-default-200"
          }}
        />
      </div>
    </div>
  )
}
