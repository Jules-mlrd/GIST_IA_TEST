"use client"

import { type ReactNode, useState, useEffect } from "react"
import {
  FileText,
  Users,
  AlertTriangle,
  Clock,
  MessageSquare,
  Search,
  BarChart3,
  LogOut,
  ArrowLeft,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Input } from "@/components/ui/input"
import { ChatBot } from "@/components/chatbot"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"

const navigationItems = [
  { title: "Project Summary", icon: BarChart3, href: "/project-summary" },
  { title: "Documents", icon: FileText, href: "/documents" },
  { title: "Contacts", icon: Users, href: "/contacts" },
  { title: "Risks", icon: AlertTriangle, href: "/risks" },
  { title: "Timeline", icon: Clock, href: "/timeline" },
  { title: "Submit a Question", icon: MessageSquare, href: "/submit-question" },
  { title: "Dashboard IA", icon: BarChart3, href: "/ai-dashboard" },
]

interface LayoutProps {
  children: ReactNode
  title: string
  subtitle?: string
}

export function Layout({ children, title, subtitle }: LayoutProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedProject, setSelectedProject] = useState<any>(null)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    // Get selected project from localStorage
    const projectData = localStorage.getItem("gist-selected-project")
    if (projectData) {
      setSelectedProject(JSON.parse(projectData))
    }
  }, [])

  const handleLogout = () => {
    localStorage.removeItem("gist-authenticated")
    localStorage.removeItem("gist-user")
    localStorage.removeItem("gist-selected-project")
    router.push("/login")
  }

  const handleBackToProjects = () => {
    router.push("/project-selection")
  }

  const userName = typeof window !== "undefined" ? localStorage.getItem("gist-user") || "Utilisateur" : "Utilisateur"

  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar className="border-r border-gray-200">
          <SidebarHeader className="border-b border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gist-blue rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">G</span>
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">GIST Connect</h2>
                <p className="text-xs text-gray-500">Gestion de projets</p>
              </div>
            </div>
            {selectedProject && (
              <div className="mt-3 p-2 bg-gray-50 rounded-lg">
                <p className="text-xs font-medium text-gray-700">{selectedProject.name}</p>
                <p className="text-xs text-gray-500">{selectedProject.id}</p>
              </div>
            )}
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={handleBackToProjects} className="text-gist-blue hover:bg-blue-50">
                      <ArrowLeft className="h-4 w-4" />
                      <span>Retour aux projets</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel className="text-gray-600 font-medium">Navigation</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navigationItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname === item.href}
                        className="data-[active=true]:bg-gist-blue data-[active=true]:text-white"
                      >
                        <Link href={item.href} className="flex items-center gap-3">
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup className="mt-auto">
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <div className="px-2 py-1 text-xs text-gray-500">Connecté en tant que: {userName}</div>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={handleLogout} className="text-red-600 hover:bg-red-50">
                      <LogOut className="h-4 w-4" />
                      <span>Se déconnecter</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <SidebarInset>
          <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-200 px-6 py-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <SidebarTrigger />
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
                  {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-auto">
            <div className="p-6 space-y-6 min-h-screen">
              {children}

              {/* Additional spacing at bottom to ensure content is not hidden behind chatbot */}
              <div className="h-24"></div>
            </div>
          </main>
        </SidebarInset>

        <ChatBot />
      </div>
    </SidebarProvider>
  )
}
