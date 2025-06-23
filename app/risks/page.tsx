"use client"

import { Layout } from "@/components/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AlertTriangle, PlusCircle, ArrowUpDown, Calendar } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"

const risks = [
  {
    id: 1,
    title: "Retard livraison matériel",
    description:
      "Le fournisseur principal a signalé des problèmes de production qui pourraient retarder la livraison du matériel nécessaire.",
    severity: "high",
    impact: "Délai +2 semaines",
    probability: 70,
    owner: "Jean Martin",
    status: "open",
    mitigation: "Contacter des fournisseurs alternatifs et préparer un plan de secours.",
    dateIdentified: "01 Mar 2024",
  },
  {
    id: 2,
    title: "Ressources techniques limitées",
    description: "L'équipe technique est actuellement en sous-effectif pour gérer la charge de travail prévue.",
    severity: "medium",
    impact: "Budget +5%",
    probability: 50,
    owner: "Marie Dubois",
    status: "mitigating",
    mitigation: "Recruter des ressources temporaires ou réaffecter des ressources d'autres projets.",
    dateIdentified: "15 Feb 2024",
  },
  {
    id: 3,
    title: "Validation réglementaire",
    description: "Le processus de validation réglementaire pourrait prendre plus de temps que prévu.",
    severity: "low",
    impact: "Délai +3 jours",
    probability: 30,
    owner: "Thomas Petit",
    status: "closed",
    mitigation:
      "Préparer tous les documents nécessaires à l'avance et maintenir une communication régulière avec les autorités.",
    dateIdentified: "10 Feb 2024",
  },
  {
    id: 4,
    title: "Dépassement budgétaire",
    description: "Les coûts des matériaux ont augmenté de 8% depuis l'estimation initiale.",
    severity: "medium",
    impact: "Budget +8%",
    probability: 60,
    owner: "Sophie Bernard",
    status: "open",
    mitigation: "Réviser le budget et identifier les postes où des économies peuvent être réalisées.",
    dateIdentified: "05 Mar 2024",
  },
  {
    id: 5,
    title: "Résistance au changement",
    description: "Les utilisateurs finaux pourraient résister à l'adoption des nouveaux processus.",
    severity: "low",
    impact: "Efficacité -10%",
    probability: 40,
    owner: "Claire Moreau",
    status: "mitigating",
    mitigation: "Mettre en place un plan de communication et de formation pour faciliter la transition.",
    dateIdentified: "20 Feb 2024",
  },
]

export default function RisksPage() {
  return (
    <Layout title="Risques" subtitle="Gestion des risques du projet">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <Badge variant="destructive" className="rounded-sm">
            {risks.filter((risk) => risk.status === "open").length} Risques actifs
          </Badge>
          <Badge variant="outline" className="rounded-sm">
            {risks.filter((risk) => risk.status === "mitigating").length} En atténuation
          </Badge>
          <Badge variant="secondary" className="rounded-sm">
            {risks.filter((risk) => risk.status === "closed").length} Résolus
          </Badge>
        </div>
        <Button className="bg-sncf-red hover:bg-red-700">
          <PlusCircle className="mr-2 h-4 w-4" />
          Ajouter un risque
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-sncf-red" />
            Registre des risques
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">ID</TableHead>
                <TableHead>Titre</TableHead>
                <TableHead>Sévérité</TableHead>
                <TableHead>
                  <div className="flex items-center">
                    Probabilité
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </div>
                </TableHead>
                <TableHead>Impact</TableHead>
                <TableHead>Responsable</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>
                  <div className="flex items-center">
                    Date
                    <Calendar className="ml-2 h-4 w-4" />
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {risks.map((risk) => (
                <TableRow key={risk.id}>
                  <TableCell className="font-medium">{risk.id}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{risk.title}</div>
                      <div className="text-sm text-gray-500 truncate max-w-xs">{risk.description}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        risk.severity === "high" ? "destructive" : risk.severity === "medium" ? "default" : "secondary"
                      }
                    >
                      {risk.severity === "high" ? "Élevé" : risk.severity === "medium" ? "Moyen" : "Faible"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={risk.probability} className="h-2 w-16" />
                      <span className="text-sm">{risk.probability}%</span>
                    </div>
                  </TableCell>
                  <TableCell>{risk.impact}</TableCell>
                  <TableCell>{risk.owner}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        risk.status === "open" ? "destructive" : risk.status === "mitigating" ? "outline" : "secondary"
                      }
                    >
                      {risk.status === "open" ? "Actif" : risk.status === "mitigating" ? "En atténuation" : "Résolu"}
                    </Badge>
                  </TableCell>
                  <TableCell>{risk.dateIdentified}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Layout>
  )
}
