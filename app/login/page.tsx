"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Bot, FileText, Zap, Shield, BarChart3, Users, ArrowRight, Building2, UserCircle2 } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function LoginPage() {
  const [clientUsername, setClientUsername] = useState("")
  const [clientPassword, setClientPassword] = useState("")
  const [collaboratorUsername, setCollaboratorUsername] = useState("")
  const [collaboratorPassword, setCollaboratorPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  // Helper to validate credentials via API route
  async function validateCredentials(username: string, password: string) {
    const res = await fetch("/api/auth/validate-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    })
    const data = await res.json()
    return data.valid
  }

  const handleClientLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    // Validate credentials from S3
    const isValid = await validateCredentials(clientUsername, clientPassword)
    if (!isValid) {
      setIsLoading(false)
      alert("Identifiant ou mot de passe incorrect.")
      return
    }

    // Store authentication state for client
    localStorage.setItem("gist-authenticated", "true")
    localStorage.setItem("gist-user", clientUsername || "Client")
    localStorage.setItem("gist-user-type", "client")

    // For clients, set the specific project and redirect directly to project summary
    const clientProject = {
      id: "GIST-2024-001",
      name: "Ligne à grande vitesse Lyon–Paris",
      description: "Modernisation des infrastructures ferroviaires sur la ligne Lyon-Paris",
      status: "active",
      progress: 68,
      manager: "Marie Dubois",
      department: "Direction Générale des Infrastructures",
      startDate: "Jan 2024",
      endDate: "Dec 2024",
      isFullyImplemented: true,
    }

    localStorage.setItem("gist-selected-project", JSON.stringify(clientProject))
    router.push("/project-summary")
  }

  const handleCollaboratorLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    // Validate credentials from S3
    const isValid = await validateCredentials(collaboratorUsername, collaboratorPassword)
    if (!isValid) {
      setIsLoading(false)
      alert("Identifiant ou mot de passe incorrect.")
      return
    }

    // Store authentication state for collaborator
    localStorage.setItem("gist-authenticated", "true")
    localStorage.setItem("gist-user", collaboratorUsername || "Collaborateur")
    localStorage.setItem("gist-user-type", "collaborator")

    // Collaborators go to project selection to see all projects
    router.push("/project-selection")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        {/* Left side - Branding and Information */}
        <div className="space-y-8">
          <div className="text-center lg:text-left">
            <div className="flex items-center justify-center lg:justify-start gap-3 mb-6">
              <div className="w-12 h-12 bg-gist-blue rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-xl">G</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">GIST Connect</h1>
                <p className="text-sm text-gray-500">Assistant IA pour projets</p>
              </div>
            </div>

            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">Bienvenue sur l'Assistant IA GIST</h2>
            <p className="text-lg text-gray-600 mb-6">
              Votre interface intelligente pour la clarté et le support de projets.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              <div className="flex items-center gap-3 p-4 bg-white rounded-lg shadow-sm border">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Bot className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">IA Avancée</h3>
                  <p className="text-sm text-gray-500">Analyse intelligente des documents</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-white rounded-lg shadow-sm border">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <BarChart3 className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Tableaux de bord</h3>
                  <p className="text-sm text-gray-500">Visualisation en temps réel</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-white rounded-lg shadow-sm border">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <FileText className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Résumés automatiques</h3>
                  <p className="text-sm text-gray-500">Synthèses de projets</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-white rounded-lg shadow-sm border">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Shield className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Sécurisé</h3>
                  <p className="text-sm text-gray-500">Données protégées GIST</p>
                </div>
              </div>
            </div>

            {/* Animated AI Processing Indicator */}
            <div className="flex items-center justify-center lg:justify-start gap-2 text-sm text-gray-500">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-gist-blue rounded-full animate-pulse"></div>
                <div
                  className="w-2 h-2 bg-gist-blue rounded-full animate-pulse"
                  style={{ animationDelay: "0.2s" }}
                ></div>
                <div
                  className="w-2 h-2 bg-gist-blue rounded-full animate-pulse"
                  style={{ animationDelay: "0.4s" }}
                ></div>
              </div>
              <span>Analyse intelligente des données projet</span>
            </div>
          </div>
        </div>

        {/* Right side - Login Forms */}
        <div className="flex justify-center">
          <Card className="w-full max-w-md shadow-xl border-0">
            <CardHeader className="text-center pb-2">
              <div className="w-16 h-16 bg-gradient-to-br from-gist-blue to-gist-dark-blue rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-2xl font-bold text-gray-900">Connexion</CardTitle>
              <CardDescription className="text-gray-600">Accédez à votre espace projet sécurisé</CardDescription>
            </CardHeader>

            <CardContent className="pt-4">
              <Tabs defaultValue="client" className="w-full">
                <TabsList className="grid grid-cols-2 mb-4">
                  <TabsTrigger value="client" className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    <span>Client</span>
                  </TabsTrigger>
                  <TabsTrigger value="collaborator" className="flex items-center gap-2">
                    <UserCircle2 className="h-4 w-4" />
                    <span>Collaborateur</span>
                  </TabsTrigger>
                </TabsList>

                {/* Client Login Form */}
                <TabsContent value="client">
                  <div className="bg-blue-50 p-3 rounded-lg mb-4">
                    <p className="text-sm text-blue-700">Accès direct au projet "Ligne à grande vitesse Lyon–Paris".</p>
                  </div>

                  <form onSubmit={handleClientLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="client-username" className="text-sm font-medium text-gray-700">
                        Identifiant client
                      </Label>
                      <Input
                        id="client-username"
                        type="text"
                        placeholder="Entrez votre identifiant client"
                        value={clientUsername}
                        onChange={(e) => setClientUsername(e.target.value)}
                        className="h-11"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="client-password" className="text-sm font-medium text-gray-700">
                        Mot de passe
                      </Label>
                      <Input
                        id="client-password"
                        type="password"
                        placeholder="Entrez votre mot de passe"
                        value={clientPassword}
                        onChange={(e) => setClientPassword(e.target.value)}
                        className="h-11"
                        required
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-11 bg-gist-blue hover:bg-gist-dark-blue text-white font-medium"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Connexion en cours...
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          Accéder à mon projet
                          <ArrowRight className="h-4 w-4" />
                        </div>
                      )}
                    </Button>

                    <div className="text-center">
                      <a href="#" className="text-xs text-gist-blue hover:underline">
                        Mot de passe oublié ?
                      </a>
                    </div>
                  </form>
                </TabsContent>

                {/* Collaborator Login Form */}
                <TabsContent value="collaborator">
                  <div className="bg-green-50 p-3 rounded-lg mb-4">
                    <p className="text-sm text-green-700">Accès à tous les projets et outils internes GIST.</p>
                  </div>

                  <form onSubmit={handleCollaboratorLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="collaborator-username" className="text-sm font-medium text-gray-700">
                        Identifiant collaborateur
                      </Label>
                      <Input
                        id="collaborator-username"
                        type="text"
                        placeholder="Entrez votre identifiant collaborateur"
                        value={collaboratorUsername}
                        onChange={(e) => setCollaboratorUsername(e.target.value)}
                        className="h-11"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="collaborator-password" className="text-sm font-medium text-gray-700">
                        Mot de passe
                      </Label>
                      <Input
                        id="collaborator-password"
                        type="password"
                        placeholder="Entrez votre mot de passe"
                        value={collaboratorPassword}
                        onChange={(e) => setCollaboratorPassword(e.target.value)}
                        className="h-11"
                        required
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-11 bg-green-600 hover:bg-green-700 text-white font-medium"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Connexion en cours...
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          Accéder aux outils internes
                          <ArrowRight className="h-4 w-4" />
                        </div>
                      )}
                    </Button>

                    <div className="text-center">
                      <a href="#" className="text-xs text-green-600 hover:underline">
                        Mot de passe oublié ?
                      </a>
                    </div>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>

            <CardFooter className="pt-0">
              <div className="w-full mt-6 pt-4 border-t border-gray-200">
                <div className="flex items-center gap-2 text-xs text-gray-500 justify-center">
                  <Zap className="h-3 w-3" />
                  <span>Propulsé par l'IA GIST • Données sécurisées</span>
                </div>
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  )
}
