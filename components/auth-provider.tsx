"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

interface AuthContextType {
  isAuthenticated: boolean
  user: string | null
  login: (username: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check if user is already authenticated
    const authenticated = localStorage.getItem("sncf-authenticated")
    const savedUser = localStorage.getItem("sncf-user")

    if (authenticated === "true" && savedUser) {
      setIsAuthenticated(true)
      setUser(savedUser)
    }
    setIsLoading(false)
  }, [])

  const login = (username: string) => {
    localStorage.setItem("sncf-authenticated", "true")
    localStorage.setItem("sncf-user", username)
    setIsAuthenticated(true)
    setUser(username)
  }

  const logout = () => {
    localStorage.removeItem("sncf-authenticated")
    localStorage.removeItem("sncf-user")
    setIsAuthenticated(false)
    setUser(null)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-sncf-red rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">S</span>
          </div>
          <div className="text-lg font-medium text-gray-900">Chargement...</div>
        </div>
      </div>
    )
  }

  return <AuthContext.Provider value={{ isAuthenticated, user, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
