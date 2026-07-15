"use client"

import React from "react"
import CompanyAgreementsView from "./view"
import useCompanyAgreementsModel from "./model"

export default function CompanyAgreements() {
  const companyAgreementsModel = useCompanyAgreementsModel()
  return <CompanyAgreementsView {...companyAgreementsModel} />
}
