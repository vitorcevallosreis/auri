import { create } from "zustand"
import type { AppRole } from "@/contexts/Auth/interfaces"

interface AuthState {
  isAuthenticated: boolean
  user?: User | null
  loading: boolean
}

interface User {
  company_id: string
  user_id: string
  hashed_password: string
  /** Papel de aplicação — decide qual área o usuário enxerga. Não autoriza
   *  nada por si: o recorte real dos dados é o RLS. */
  role: AppRole
}

interface AuthStore extends AuthState {
  /** Recebe um objeto, não argumentos posicionais. A assinatura antiga era
   *  `(company_id, user_id, hashed_password)` — três strings em sequência, em
   *  que trocar duas de lugar compilava e falhava em silêncio. Ao acrescentar
   *  um quarto campo o risco só aumentaria. */
  setAuth: (user: User) => void
  clearAuth: () => void
}

// Removida a persistência no localStorage, agora apenas estado em memória
export const useAuthStore = create<AuthStore>()((set) => ({
  isAuthenticated: false,
  user: null,
  loading: false,
  setAuth: (user: User) =>
    set({
      isAuthenticated: true,
      user,
      loading: false,
    }),
  clearAuth: () =>
    set({
      isAuthenticated: false,
      user: null,
      loading: false,
    }),
}))

// Initialize hydration
if (typeof window !== "undefined") {
  // Removed the rehydrate call since persistence was removed
}
