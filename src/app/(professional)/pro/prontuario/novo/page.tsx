"use client"

import { useNovoProntuarioModel } from "./model"
import { NovoProntuarioView } from "./view"

export default function NovoProntuarioPage() {
  const model = useNovoProntuarioModel()
  return <NovoProntuarioView {...model} />
}
