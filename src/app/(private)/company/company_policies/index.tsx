"use client"

import React from "react"
import CompanyPoliciesView from "./view"
import useCompanyPoliciesModel from "./model"

export default function CompanyPolicies() {
  const companyPoliciesModel = useCompanyPoliciesModel()
  return <CompanyPoliciesView {...companyPoliciesModel} />
}
