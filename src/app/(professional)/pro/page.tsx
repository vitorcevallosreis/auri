"use client"

import { useMeuDiaModel } from "./model"
import { MeuDiaView } from "./view"

export default function MeuDiaPage() {
  const model = useMeuDiaModel()
  return <MeuDiaView {...model} />
}
