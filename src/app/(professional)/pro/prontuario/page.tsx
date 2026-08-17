"use client"

import { useProntuarioListModel } from "./model"
import { ProntuarioListView } from "./view"

export default function ProntuarioPage() {
  const model = useProntuarioListModel()
  return <ProntuarioListView {...model} />
}
