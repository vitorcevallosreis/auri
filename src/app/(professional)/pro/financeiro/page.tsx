"use client"

import { useFinanceiroModel } from "./model"
import { FinanceiroView } from "./view"

export default function FinanceiroPage() {
  const model = useFinanceiroModel()
  return <FinanceiroView {...model} />
}
