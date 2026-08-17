"use client"

import { useRecordTemplates } from "@/hooks/useMedicalRecords"
import { ModelosView } from "./view"

export default function ModelosPage() {
  const model = useRecordTemplates()
  return <ModelosView {...model} />
}
