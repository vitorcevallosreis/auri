export interface ServicesProps {
  children: React.ReactNode
}

export interface ServicesContextType {
  isLoading: boolean
  getServices: () => Promise<void>
  services: Service[]
  service: Service
  getService: (service_id: string) => Promise<void>
  createService: (body: BodyCreateService) => Promise<void>
  updateService: (service_id: string, body: BodyUpdateService) => Promise<void>
  deleteService: (service_id: string) => Promise<void>
  uploadImageService: (
    service: Service,
    file: File,
    file_path: string
  ) => Promise<boolean>
}

export interface Defaults {
  isLoading: boolean
  services: Service[]
  service: Service
}

export interface Service {
  id: string
  created_at: string
  name: string
  price: number
  description: string
  tempo_medio: string
  available: boolean
  company_id: string
  image_path: string | null
  aceita_convenio: boolean
  valores_convenios: ConvenioValor[] | null
}

export interface ConvenioValor {
  convenio: string
  valor: number
  enable: boolean
}

export interface BodyCreateService {
  name: string
  price: number
  description: string
  tempo_medio: string
  available: boolean
  aceita_convenio: boolean
  valores_convenios?: ConvenioValor[]
}

export interface BodyUpdateService {
  name: string
  price: number
  description: string
  tempo_medio: string
  available: boolean
  aceita_convenio: boolean
  valores_convenios?: ConvenioValor[]
}
