export interface SpecialtiesProps {
  children: React.ReactNode
}

export interface SpecialtiesContextType {
  isLoading: boolean
  getSpecialties: () => Promise<void>
  specialties: Specialty[]
}

export interface Defaults {
  isLoading: boolean
  specialties: Specialty[]
}

export interface Specialty {
  id: string
  name: string
  description: string
  created_at: string
  company_id: string
}
