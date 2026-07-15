export interface CompanyProviderProps {
  children: React.ReactNode
}

export interface CompanyContextType {
  isLoading: boolean
  getCompany: () => Promise<void>
  company: Company
  updateCompany: (body: BodyUpdateCompany) => Promise<void>
  updateCompanyAddress: (
    company_id: string,
    body: BodyCompanyAddress
  ) => Promise<void>
  getCompanyAddress: () => Promise<void>
  company_address: CompanyAddress
  
  // Company Agreements
  companyAgreements: CompanyAgreement[]
  getCompanyAgreements: () => Promise<void>
  createCompanyAgreement: (body: BodyCompanyAgreement) => Promise<void>
  updateCompanyAgreement: (id: string, body: BodyCompanyAgreement) => Promise<void>
  deleteCompanyAgreement: (id: string) => Promise<void>

  // Company Payment Methods
  companyPaymentMethods: CompanyPaymentMethod[]
  getCompanyPaymentMethods: () => Promise<void>
  createCompanyPaymentMethod: (body: BodyCompanyPaymentMethod) => Promise<void>
  updateCompanyPaymentMethod: (id: string, body: BodyCompanyPaymentMethod) => Promise<void>
  deleteCompanyPaymentMethod: (id: string) => Promise<void>

  // Company Policies
  companyPolicies: CompanyPolicy[]
  getCompanyPolicies: () => Promise<void>
  createCompanyPolicy: (body: BodyCompanyPolicy) => Promise<void>
  updateCompanyPolicy: (id: string, body: BodyCompanyPolicy) => Promise<void>
  deleteCompanyPolicy: (id: string) => Promise<void>
  
  // Company Specialties
  companySpecialties: CompanySpecialty[]
  getCompanySpecialties: () => Promise<void>
  createCompanySpecialty: (body: BodyCompanySpecialty) => Promise<void>
  updateCompanySpecialty: (id: string, body: BodyCompanySpecialty) => Promise<void>
  deleteCompanySpecialty: (id: string) => Promise<void>
  
  // Cache management
  resetDataLoaded: () => void
}

export interface Defaults {
  isLoading: boolean
  company: Company
  company_address: CompanyAddress
  companyAgreements: CompanyAgreement[]
  companyPaymentMethods: CompanyPaymentMethod[]
  companyPolicies: CompanyPolicy[]
  companySpecialties: CompanySpecialty[]
}

export interface Company {
  id: string
  name: string
  description: string | null
  site_url: string | null
  domain_server: string | null
  created_at: string
}

export interface BodyUpdateCompany {
  name: string
  description: string | null
  site_url: string | null
}

export interface CompanyAddress {
  id: string
  company_id: string
  zip_code: string
  street: string | null
  number: string | null
  complement: string | null
  neighborhood: string | null
  city: string | null
  state_code: string | null
  state: string | null
  created_at: string
  latitude: number | null
  longitude: number | null
}

export type BodyCompanyAddress = Omit<
  CompanyAddress,
  "id" | "company_id" | "created_at"
>

// Company Agreement interfaces
export interface CompanyAgreement {
  id: string
  company_id: string
  name: string
  status: boolean
  created_at: string
  updated_at: string
  description: string | null
}

export interface BodyCompanyAgreement {
  name: string
  status: boolean
  description?: string
}

// Company Payment Method interfaces
export interface CompanyPaymentMethod {
  id: string
  company_id: string
  name: string
  status: boolean
  created_at: string
  updated_at: string
}

export interface BodyCompanyPaymentMethod {
  name: string
  status: boolean
}

// Company Policy interfaces
export interface CompanyPolicy {
  id: string
  company_id: string
  name: string
  description: string
  status: boolean
  created_at: string
  updated_at: string
}

export interface BodyCompanyPolicy {
  name: string
  description: string
  status: boolean
}

// Company Specialty interfaces
export interface CompanySpecialty {
  id: string
  company_id: string
  name: string
  description: string | null
  created_at: string
}

export interface BodyCompanySpecialty {
  name: string
  description?: string | null
}
