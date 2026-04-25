import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import api from '@/lib/api'

export interface User {
  id: string
  email: string
  name: string
  emailVerified: boolean
  createdAt: string
  updatedAt: string
}

export type LoginResult =
  | { type: 'authenticated'; user: User }
  | { type: 'two_factor_required' }

export interface AuthContextValue {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<LoginResult>
  logout: () => Promise<void>
  setUser: (user: User | null) => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    api
      .get<User>('/auth/me')
      .then((res) => setUser(res.data))
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false))
  }, [])

  async function login(email: string, password: string): Promise<LoginResult> {
    const res = await api.post<User | { requiresTwoFactor: true }>('/auth/login', {
      email,
      password,
    })

    if ('requiresTwoFactor' in res.data && res.data.requiresTwoFactor) {
      return { type: 'two_factor_required' }
    }

    const userData = res.data as User
    setUser(userData)
    return { type: 'authenticated', user: userData }
  }

  async function logout(): Promise<void> {
    await api.post('/auth/logout')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
