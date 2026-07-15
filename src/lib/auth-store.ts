import { create } from "zustand"

interface AuthState {
  isAuthenticated: boolean
  user?: User | null
  loading: boolean
}

interface User {
  company_id: string
  user_id: string
  hashed_password: string
}

interface AuthStore extends AuthState {
  setAuth: (
    company_id: string,
    user_id: string,
    hashed_password: string
  ) => void
  clearAuth: () => void
}

// Removida a persistência no localStorage, agora apenas estado em memória
export const useAuthStore = create<AuthStore>()((set) => ({
  isAuthenticated: false,
  user: null,
  loading: false,
  setAuth: (company_id: string, user_id: string, hashed_password: string) =>
    set({
      isAuthenticated: true,
      user: {
        company_id,
        user_id,
        hashed_password,
      },
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
