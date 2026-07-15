import { Defaults } from "./interfaces"

export const Default: Defaults = {
  isLoading: false,
  company: {
    id: "",
    name: "",
    description: "",
    site_url: null,
    domain_server: null,
    created_at: "",
  },
  company_address: {
    id: "",
    company_id: "",
    zip_code: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state_code: "",
    state: "",
    created_at: "",
    longitude: null,
    latitude: null,
  },
  companyAgreements: [],
  companyPaymentMethods: [],
  companyPolicies: [],
  companySpecialties: []
} as Defaults
