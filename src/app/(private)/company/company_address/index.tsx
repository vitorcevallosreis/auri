"use client"

import useCompanyAddressModel from "./model"
import CompanyAddressView from "./view"

export default function CompanyAddress() {
  const companyAddressModel = useCompanyAddressModel()

  return <CompanyAddressView {...companyAddressModel} />
}
