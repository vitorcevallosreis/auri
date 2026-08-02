"use client"

import { useParams } from "next/navigation"
import { useMedicalRecord } from "@/hooks/useMedicalRecords"
import { ProntuarioDetailView } from "./view"

export default function ProntuarioDetailPage() {
  // `useParams` em vez da prop `params`: no Next 15 ela é uma Promise em Server
  // Components, e esta página é client — o hook resolve sem cerimônia.
  const params = useParams<{ id: string }>()
  const { record, loading, error } = useMedicalRecord(params?.id ?? "")
  return <ProntuarioDetailView record={record} loading={loading} error={error} />
}
