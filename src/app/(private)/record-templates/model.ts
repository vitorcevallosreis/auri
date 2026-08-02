"use client"

import { useContext, useMemo, useState } from "react"
import { AuthContext } from "@/contexts/Auth"
import { useRecordTemplateAdmin } from "@/hooks/useRecordTemplateAdmin"
import type { RecordTemplate } from "@/hooks/useMedicalRecords"

export function useRecordTemplatesModel() {
  const { user } = useContext(AuthContext)
  const admin = useRecordTemplateAdmin(user?.company_id)
  const [busca, setBusca] = useState("")

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return admin.templates
    return admin.templates.filter(
      (t) =>
        t.name.toLowerCase().includes(termo) ||
        (t.specialty ?? "").toLowerCase().includes(termo)
    )
  }, [admin.templates, busca])

  // Separados porque o que se pode FAZER com cada um é diferente: o do sistema
  // só se duplica, o próprio se edita e se arquiva. Misturá-los numa lista só
  // obrigaria a explicar essa diferença linha a linha.
  const doSistema = filtrados.filter((t: RecordTemplate) => t.isSystem)
  const daClinica = filtrados.filter((t: RecordTemplate) => !t.isSystem)

  return { ...admin, busca, setBusca, doSistema, daClinica }
}

export type IRecordTemplatesModel = ReturnType<typeof useRecordTemplatesModel>
