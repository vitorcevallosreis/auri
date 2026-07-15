export interface AuthProviderProps {
  children: React.ReactNode
}

export type SignInData = {
  email: string
  password: string
}

export interface SignUnData {
  company_name: string
  domain_server: string
  name: string
  email: string
  password: string
}

export interface AuthToken {
  user_id: string
  company_id: string
  hashed_password: string
}

export type AuthContextType = {
  user: AuthToken | null
  isLoading: boolean
  signIn: (data: SignInData) => Promise<void>
  signUp: (body: SignUnData) => Promise<void>
  singOut: () => void
  checkAvailableDomain: (domain_server: string) => Promise<boolean>
}

export enum EnumStatusMessage {
  SUCCESS = "sucesso",
  FAILED = "falha",
}

export interface IReponseSignIn {
  status: EnumStatusMessage
  message: string
  company_id?: string
  usuario_id?: string
  motivo?: string
}
