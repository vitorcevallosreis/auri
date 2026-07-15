"use client"

import React from "react"
import CompanyPaymentMethodsView from "./view"
import useCompanyPaymentMethodsModel from "./model"

export default function CompanyPaymentMethods() {
  const companyPaymentMethodsModel = useCompanyPaymentMethodsModel()
  return <CompanyPaymentMethodsView {...companyPaymentMethodsModel} />
}
