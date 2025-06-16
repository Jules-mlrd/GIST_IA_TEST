"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Search, ArrowRight, Calendar, Users, AlertTriangle, FileText, Building2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

const allProjects = [
	{
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
		clientAccess: true, // This project is accessible to clients
	},
	{
		id: "GIST-2024-002",
		name: "Rénovation Gare du Nord",
		description: "Rénovation complète des espaces voyageurs de la Gare du Nord",
		status: "active",
		progress: 45,
		manager: "Pierre Martin",
		department: "Direction des Gares",
		startDate: "Mar 2024",
		endDate: "Sep 2025",
		isFullyImplemented: false,
		clientAccess: false, // Internal project only
	},
	{
		id: "GIST-2024-003",
		name: "Digitalisation Billetterie",
		description: "Modernisation du système de billetterie et applications mobiles",
		status: "active",
		progress: 82,
		manager: "Sophie Leroy",
		department: "Direction Digitale",
		startDate: "Nov 2023",
		endDate: "Jun 2024",
		isFullyImplemented: false,
		clientAccess: false, // Internal project only
	},
	{
		id: "GIST-2024-004",
		name: "Extension Ligne 14",
		description: "Extension de la ligne 14 du métro vers Saint-Ouen",
		status: "planning",
		progress: 15,
		manager: "Jean Dupont",
		department: "Direction des Projets",
		startDate: "Jun 2024",
		endDate: "Dec 2026",
		isFullyImplemented: false,
		clientAccess: false, // Internal project only
	},
	{
		id: "GIST-2024-005",
		name: "Maintenance Prédictive",
		description: "Implémentation de l'IA pour la maintenance prédictive des trains",
		status: "active",
		progress: 33,
		manager: "Claire Moreau",
		department: "Direction Technique",
		startDate: "Feb 2024",
		endDate: "Nov 2024",
		isFullyImplemented: false,
		clientAccess: false, // Internal project only
	},
	{
		id: "GIST-2023-012",
		name: "Sécurisation Passages à Niveau",
		description: "Modernisation des systèmes de sécurité aux passages à niveau",
		status: "completed",
		progress: 100,
		manager: "Thomas Petit",
		department: "Direction Sécurité",
		startDate: "Jan 2023",
		endDate: "Dec 2023",
		isFullyImplemented: false,
		clientAccess: false, // Internal project only
	},
]

export default function ProjectSelectionPage() {
	const [searchQuery, setSearchQuery] = useState("")
	const [filteredProjects, setFilteredProjects] = useState(allProjects)
	const [userType, setUserType] = useState<string | null>(null)
	const router = useRouter()

	useEffect(() => {
		// Check authentication
		const isAuthenticated = localStorage.getItem("gist-authenticated")
		const currentUserType = localStorage.getItem("gist-user-type")

		if (isAuthenticated !== "true") {
			router.push("/login")
			return
		}

		setUserType(currentUserType)

		// Filter projects based on user type and search query
		let projectsToShow = allProjects

		// If user is a client, only show projects with clientAccess: true
		if (currentUserType === "client") {
			projectsToShow = allProjects.filter((project) => project.clientAccess)
		}

		// Apply search filter
		const filtered = projectsToShow.filter(
			(project) =>
				project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				project.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
				project.description.toLowerCase().includes(searchQuery.toLowerCase()),
		)
		setFilteredProjects(filtered)
	}, [searchQuery, router])

	const handleProjectSelect = (project: (typeof allProjects)[0]) => {
		if (project.isFullyImplemented) {
			// Store selected project info
			localStorage.setItem("gist-selected-project", JSON.stringify(project))
			router.push("/project-summary")
		} else {
			// For placeholder projects, show a message or redirect to a placeholder page
			alert(
				`Le projet "${project.name}" est en cours de configuration. Seul le projet "Lyon–Paris high-speed line" est actuellement disponible.`,
			)
		}
	}

	const getStatusBadge = (status: string) => {
		switch (status) {
			case "active":
				return <Badge className="bg-green-100 text-green-800 border-green-200">Actif</Badge>
			case "planning":
				return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Planification</Badge>
			case "completed":
				return <Badge className="bg-gray-100 text-gray-800 border-gray-200">Terminé</Badge>
			default:
				return <Badge variant="outline">Inconnu</Badge>
		}
	}

	const getProgressColor = (progress: number) => {
		if (progress >= 75) return "bg-green-500"
		if (progress >= 50) return "bg-yellow-500"
		if (progress >= 25) return "bg-orange-500"
		return "bg-red-500"
	}

	const userName = typeof window !== "undefined" ? localStorage.getItem("gist-user") || "Utilisateur" : "Utilisateur"

	return (
		<div className="min-h-screen bg-gray-50">
			{/* Header */}
			<header className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
				<div className="max-w-7xl mx-auto">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-4">
							<div className="w-8 h-8 bg-gist-blue rounded-lg flex items-center justify-center">
								<span className="text-white font-bold text-sm">G</span>
							</div>
							<div>
								<h1 className="text-xl font-semibold text-gray-900">GIST Connect</h1>
								<p className="text-sm text-gray-500">
									{userType === "client" ? "Espace Client" : "Sélection de projet"}
								</p>
							</div>
						</div>
						<div className="flex items-center gap-4">
							<span className="text-sm text-gray-600">
								Bonjour, {userName} {userType === "client" && "(Client)"}
							</span>
							<Button
								variant="outline"
								size="sm"
								onClick={() => {
									localStorage.removeItem("gist-authenticated")
									localStorage.removeItem("gist-user")
									localStorage.removeItem("gist-user-type")
									router.push("/login")
								}}
							>
								Se déconnecter
							</Button>
						</div>
					</div>
				</div>
			</header>

			{/* Main Content */}
			<main className="max-w-7xl mx-auto p-6">
				<div className="mb-8">
					<h2 className="text-2xl font-bold text-gray-900 mb-2">
						{userType === "client" ? "Votre Projet" : "Vos Projets"}
					</h2>
					<p className="text-gray-600">
						{userType === "client"
							? "Accédez aux informations détaillées de votre projet."
							: "Sélectionnez un projet pour accéder à son tableau de bord et ses informations détaillées."}
					</p>
				</div>

				{/* Search Bar - Only show for collaborators or if there are multiple projects */}
				{(userType !== "client" || filteredProjects.length > 1) && (
					<div className="mb-6">
						<div className="relative max-w-md">
							<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
							<Input
								placeholder="Rechercher par nom, ID ou description..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="pl-10"
							/>
						</div>
					</div>
				)}

				{/* Projects Grid */}
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{filteredProjects.map((project) => (
						<Card
							key={project.id}
							className={`cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] ${
								project.isFullyImplemented ? "border-gist-blue/20 hover:border-gist-blue/40" : "hover:border-gray-300"
							}`}
							onClick={() => handleProjectSelect(project)}
						>
							<CardHeader className="pb-3">
								<div className="flex items-start justify-between">
									<div className="flex-1">
										<CardTitle className="text-lg font-semibold text-gray-900 mb-1">
											{project.name}
										</CardTitle>
										<CardDescription className="text-sm text-gray-500 mb-2">
											{project.id}
										</CardDescription>
									</div>
									{project.isFullyImplemented && (
										<Badge className="bg-gist-blue text-white">Disponible</Badge>
									)}
								</div>
								<p className="text-sm text-gray-600 line-clamp-2">{project.description}</p>
							</CardHeader>

							<CardContent className="pt-0">
								<div className="space-y-3">
									<div className="flex items-center justify-between">
										{getStatusBadge(project.status)}
										<span className="text-sm font-medium text-gray-900">{project.progress}%</span>
									</div>

									<div className="w-full bg-gray-200 rounded-full h-2">
										<div
											className={`${getProgressColor(project.progress)} h-2 rounded-full transition-all duration-300`}
											style={{ width: `${project.progress}%` }}
										></div>
									</div>

									<div className="space-y-2 text-xs text-gray-500">
										<div className="flex items-center gap-2">
											<Users className="h-3 w-3" />
											<span>{project.manager}</span>
										</div>
										<div className="flex items-center gap-2">
											<Building2 className="h-3 w-3" />
											<span className="truncate">{project.department}</span>
										</div>
										<div className="flex items-center gap-2">
											<Calendar className="h-3 w-3" />
											<span>
												{project.startDate} - {project.endDate}
											</span>
										</div>
									</div>

									<div className="pt-2 border-t border-gray-100">
										<div className="flex items-center justify-between">
											<span className="text-xs text-gray-500">
												{project.isFullyImplemented ? "Cliquez pour accéder" : "Configuration en cours"}
											</span>
											<ArrowRight className="h-4 w-4 text-gray-400" />
										</div>
									</div>
								</div>
							</CardContent>
						</Card>
					))}
				</div>

				{filteredProjects.length === 0 && (
					<div className="text-center py-12">
						<FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
						<h3 className="text-lg font-medium text-gray-900 mb-2">Aucun projet trouvé</h3>
						<p className="text-gray-500">Essayez de modifier votre recherche ou contactez votre administrateur.</p>
					</div>
				)}

				{/* Info Section */}
				{userType === "client" ? (
					<div className="mt-12 bg-blue-50 border border-blue-200 rounded-lg p-6">
						<div className="flex items-start gap-3">
							<AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5" />
							<div>
								<h3 className="font-medium text-blue-900 mb-1">Information Client</h3>
								<p className="text-sm text-blue-800">
									En tant que client, vous avez accès uniquement au projet "Lyon–Paris high-speed line" et à
									toutes ses informations détaillées.
								</p>
							</div>
						</div>
					</div>
				) : (
					<div className="mt-12 bg-blue-50 border border-blue-200 rounded-lg p-6">
						<div className="flex items-start gap-3">
							<AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5" />
							<div>
								<h3 className="font-medium text-blue-900 mb-1">Information</h3>
								<p className="text-sm text-blue-800">
									Actuellement, seul le projet "Lyon–Paris high-speed line" est entièrement configuré et
									accessible. Les autres projets sont affichés à des fins de démonstration et seront
									disponibles prochainement.
								</p>
							</div>
						</div>
					</div>
				)}
			</main>
		</div>
	)
}
