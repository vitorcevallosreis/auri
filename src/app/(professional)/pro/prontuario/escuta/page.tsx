"use client"

import { useEscutaModel } from "./model"
import { EscutaView } from "./view"

export default function EscutaPage() {
  const model = useEscutaModel()
  return <EscutaView {...model} />
}
