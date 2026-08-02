"use client"

import { useRecordTemplatesModel } from "./model"
import { RecordTemplatesView } from "./view"

export default function RecordTemplatesPage() {
  const model = useRecordTemplatesModel()
  return <RecordTemplatesView {...model} />
}
