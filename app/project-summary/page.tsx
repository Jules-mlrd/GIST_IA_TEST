"use client"

import { Layout } from "@/components/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { CheckCircle, AlertCircle, CalendarIcon, Users, Target, FileText, Building } from "lucide-react"
import { Badge } from "@/components/ui/badge"

const projectData = {
  name: "Ligne à grande vitesse Lyon–Paris",
  id: "GIST-2024-001",
  progress: 68,
  status: "on-track",
  nextDeadline: "15 Mars 2024",
  projectManager: "Marie Dubois",
  budget: "€2.4M",
  budgetUsed: 62,
  startDate: "01 Janvier 2024",
  endDate: "31 Décembre 2024",
  client: "Direction Générale des Infrastructures",
  objectives: [
    "Moderniser les infrastructures ferroviaires sur la ligne Lyon-Paris",
    "Améliorer la fiabilité et la ponctualité des trains",
    "Augmenter la capacité de la ligne de 15%",
    "Réduire les coûts de maintenance de 20%",
  ],
  description:
    "Ce projet vise à moderniser l'ensemble des infrastructures ferroviaires sur la ligne Lyon-Paris, l'une des plus fréquentées du réseau GIST. Il comprend le renouvellement des voies, la modernisation des systèmes de signalisation, l'amélioration des gares intermédiaires et l'optimisation des systèmes d'information voyageurs. Cette modernisation permettra d'augmenter la fréquence des trains, d'améliorer leur ponctualité et de réduire les coûts d'exploitation.",
}

const milestones = [
  { name: "Étude de faisabilité", status: "completed", date: "15 Jan 2024" },
  { name: "Validation technique", status: "completed", date: "28 Feb 2024" },
  { name: "Phase de développement", status: "in-progress", date: "15 Mar 2024" },
  { name: "Tests et validation", status: "pending", date: "30 Apr 2024" },
  { name: "Mise en production", status: "pending", date: "15 Jun 2024" },
]

export default function ProjectSummaryPage() {
  return (
    <Layout title="Résumé du projet" subtitle={`ID: ${projectData.id}`}>
      {/* Section d'informations sur le projet */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-gist-blue" />
            Informations du projet
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{projectData.name}</h3>
                <p className="text-sm text-gray-500">ID: {projectData.id}</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Chef de projet:</span>
                  <span className="text-sm text-gray-600">{projectData.projectManager}</span>
                </div>

                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Période:</span>
                  <span className="text-sm text-gray-600">
                    {projectData.startDate} - {projectData.endDate}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Client:</span>
                  <span className="text-sm text-gray-600">{projectData.client}</span>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Target className="h-4 w-4 text-gray-500" />
                  Objectifs
                </h4>
                <ul className="list-disc pl-5 space-y-1">
                  {projectData.objectives.map((objective, index) => (
                    <li key={index} className="text-sm text-gray-600">
                      {objective}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Description du projet</h4>
              <p className="text-sm text-gray-600">{projectData.description}</p>

              <div className="mt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Phases clés</h4>
                <div className="space-y-3">
                  {milestones.map((milestone, index) => (
                    <div key={index} className="flex items-center gap-2">
                      {milestone.status === "completed" && (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          Terminé
                        </Badge>
                      )}
                      {milestone.status === "in-progress" && (
                        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                          En cours
                        </Badge>
                      )}
                      {milestone.status === "pending" && (
                        <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                          À venir
                        </Badge>
                      )}
                      <span className="text-sm font-medium">{milestone.name}</span>
                      <span className="text-xs text-gray-500">{milestone.date}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section des métriques du projet */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Progression</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{projectData.progress}%</div>
            <Progress value={projectData.progress} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Prochaine échéance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{projectData.nextDeadline}</div>
            <p className="text-sm text-gray-500 mt-1">Phase de développement</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Budget utilisé</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{projectData.budgetUsed}%</div>
            <p className="text-sm text-gray-500 mt-1">sur {projectData.budget}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Chef de projet</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback>MD</AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium text-gray-900">{projectData.projectManager}</div>
                <div className="text-xs text-gray-500">Disponible</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Jalons du projet</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {milestones.map((milestone, index) => (
              <div key={index} className="flex items-center gap-3">
                {milestone.status === "completed" && <CheckCircle className="h-5 w-5 text-green-500" />}
                {milestone.status === "in-progress" && <AlertCircle className="h-5 w-5 text-yellow-500" />}
                {milestone.status === "pending" && <div className="h-5 w-5 border-2 border-gray-300 rounded-full" />}
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{milestone.name}</div>
                  <div className="text-sm text-gray-500">{milestone.date}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </Layout>
  )
}
