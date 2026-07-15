"use client"

import useProfessionalPageModel from "./model"
import ProfessionalPageView from "./view"

export default function ProfessionalsPage() {
  const professionalPageModel = useProfessionalPageModel()

  return <ProfessionalPageView {...professionalPageModel} />
}
