"use client"

import useCompanyPageModel from "./model"
import CompanyPageView from "./view"

export default function CompanyPage() {
  const companyPageModel = useCompanyPageModel()

  return <CompanyPageView {...companyPageModel} />
}
