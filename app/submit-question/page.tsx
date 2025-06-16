"use client"

import { Layout } from "@/components/layout"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MessageSquare, Send, HelpCircle } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const ticketHistory = [
  {
    id: 1,
    question: "Quelle est la prochaine échéance ?",
    answer: "La prochaine échéance est le 15 mars 2024 pour la phase de développement.",
    date: "12 Mar 2024",
    status: "resolved",
  },
  {
    id: 2,
    question: "Qui est responsable de la tâche 3 ?",
    answer: "Jean Martin est responsable de cette tâche. Contact: j.martin@sncf.fr",
    date: "10 Mar 2024",
    status: "resolved",
  },
  {
    id: 3,
    question: "Budget restant disponible ?",
    answer: "Il reste 38% du budget initial, soit environ €912,000.",
    date: "08 Mar 2024",
    status: "resolved",
  },
]

const faqs = [
  {
    question: "Comment puis-je suivre l'avancement du projet ?",
    answer:
      "Vous pouvez suivre l'avancement du projet sur la page 'Project Summary' qui affiche les indicateurs clés de performance, les jalons et l'état général du projet.",
  },
  {
    question: "Comment télécharger les documents du projet ?",
    answer:
      "Accédez à la page 'Documents', trouvez le document souhaité et cliquez sur l'icône de téléchargement à droite de chaque document.",
  },
  {
    question: "Comment contacter le chef de projet ?",
    answer:
      "Vous pouvez contacter le chef de projet via la page 'Contacts' où vous trouverez ses coordonnées, ou en utilisant le formulaire de soumission de question sur cette page.",
  },
  {
    question: "Comment signaler un nouveau risque ?",
    answer:
      "Accédez à la page 'Risks' et cliquez sur le bouton 'Ajouter un risque' en haut à droite pour soumettre un nouveau risque au registre.",
  },
]

export default function SubmitQuestionPage() {
  return (
    <Layout title="Submit a Question" subtitle="Posez vos questions sur le projet">
      <Tabs defaultValue="new" className="w-full">
        <TabsList>
          <TabsTrigger value="new">Nouvelle question</TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
          <TabsTrigger value="faq">FAQ</TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-sncf-red" />
                Soumettre une question
              </CardTitle>
              <CardDescription>
                Posez votre question à l'équipe projet. Nous vous répondrons dans les plus brefs délais.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nom</Label>
                    <Input id="name" placeholder="Votre nom" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" placeholder="votre.email@example.com" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subject">Sujet</Label>
                  <Input id="subject" placeholder="Sujet de votre question" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Catégorie</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionnez une catégorie" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planning">Planning</SelectItem>
                      <SelectItem value="technical">Technique</SelectItem>
                      <SelectItem value="budget">Budget</SelectItem>
                      <SelectItem value="resources">Ressources</SelectItem>
                      <SelectItem value="other">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="question">Votre question</Label>
                  <Textarea id="question" placeholder="Détaillez votre question ici..." className="min-h-32" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority">Priorité</Label>
                  <Select defaultValue="normal">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">Haute</SelectItem>
                      <SelectItem value="normal">Normale</SelectItem>
                      <SelectItem value="low">Basse</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </form>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline">Annuler</Button>
              <Button className="bg-sncf-red hover:bg-red-700">
                <Send className="mr-2 h-4 w-4" />
                Envoyer
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Historique des questions</CardTitle>
              <CardDescription>Consultez l'historique de vos questions et des réponses apportées.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {ticketHistory.map((ticket) => (
                  <div key={ticket.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-medium text-gray-900">Q: {ticket.question}</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">{ticket.date}</span>
                      </div>
                    </div>
                    <p className="text-gray-600 mb-3">R: {ticket.answer}</p>
                    <div className="flex justify-between items-center">
                      <Button variant="outline" size="sm">
                        Poser une question similaire
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="faq" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-sncf-red" />
                Questions fréquentes
              </CardTitle>
              <CardDescription>Consultez les réponses aux questions les plus fréquemment posées.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {faqs.map((faq, index) => (
                  <div key={index} className="border-b pb-4 last:border-b-0">
                    <h3 className="font-medium text-gray-900 mb-2">{faq.question}</h3>
                    <p className="text-gray-600">{faq.answer}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </Layout>
  )
}
