"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    // Check if user is authenticated
    const isAuthenticated = localStorage.getItem("gist-authenticated")

    if (isAuthenticated === "true") {
      // User is authenticated, redirect to project selection
      router.push("/project-selection")
    } else {
      // User is not authenticated, redirect to login
      router.push("/login")
    }
  }, [router])

  // Show loading state while checking authentication
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-gist-blue rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-sm">G</span>
        </div>
        <div className="text-lg font-medium text-gray-900">Chargement...</div>
      </div>
    </div>
  )
}
