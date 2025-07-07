"use client"

import React, { useEffect, useRef, useState } from "react"
import { Layout } from "@/components/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { HelpCircle, BarChart3, FileText, Users, AlertTriangle, Clock, MessageSquare, LifeBuoy } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

const sections = [
  {
    icon: <BarChart3 className="h-8 w-8 text-blue-600" />, 
    title: "Résumé du projet",
    description: "Visualisez les indicateurs clés, jalons et l'état global du projet.",
    link: "/project-summary",
    cta: "Découvrir"
  },
  {
    icon: <FileText className="h-8 w-8 text-green-600" />, 
    title: "Documents",
    description: "Accédez, téléchargez et gérez tous les documents du projet.",
    link: "/documents",
    cta: "Voir les documents"
  },
  {
    icon: <Users className="h-8 w-8 text-purple-600" />, 
    title: "Contacts",
    description: "Trouvez rapidement les membres de l'équipe et leurs coordonnées.",
    link: "/contacts",
    cta: "Voir les contacts"
  },
  {
    icon: <AlertTriangle className="h-8 w-8 text-red-500" />, 
    title: "Risques",
    description: "Consultez et signalez les risques liés au projet.",
    link: "/risks",
    cta: "Gérer les risques"
  },
  {
    icon: <Clock className="h-8 w-8 text-yellow-500" />, 
    title: "Timeline",
    description: "Suivez la chronologie et les étapes importantes du projet.",
    link: "/timeline",
    cta: "Voir la timeline"
  },
  {
    icon: <BarChart3 className="h-8 w-8 text-cyan-600" />, 
    title: "Dashboard IA",
    description: "Analysez vos documents grâce à l'intelligence artificielle.",
    link: "/ai-dashboard",
    cta: "Explorer l'IA"
  },
]

const faqs = [
  {
    question: "Comment démarrer avec l'application ?",
    answer: "Sélectionnez d'abord un projet, puis explorez les différentes sections via le menu de gauche ou les cartes ci-dessus."
  },
  {
    question: "Comment contacter le support ?",
    answer: "Cliquez sur le bouton 'Besoin d'aide ?' en bas de cette page pour accéder au formulaire de contact."
  },
  {
    question: "Puis-je télécharger tous les documents ?",
    answer: "Oui, rendez-vous dans la section Documents pour télécharger ce dont vous avez besoin."
  },
  {
    question: "Comment signaler un risque ?",
    answer: "Allez dans la section Risques et cliquez sur 'Ajouter un risque'."
  },
]

const steps = [
  "Sélectionnez un projet depuis la page d'accueil.",
  "Consultez le résumé pour avoir une vue d'ensemble.",
  "Téléchargez ou ajoutez des documents.",
  "Contactez les membres de l'équipe si besoin.",
  "Signalez ou consultez les risques.",
  "Utilisez le Dashboard IA pour des analyses avancées."
]

export default function HelpCenterPage() {
  const [tab, setTab] = useState<string>("formulaire")
  const formulaireRef = useRef<HTMLDivElement>(null)
  const [email, setEmail] = useState("")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string|null>(null)

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (window.location.hash === "#formulaire") {
        setTab("formulaire")
        setTimeout(() => {
          formulaireRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
        }, 100)
      }
    }
  }, [])

  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setSuccess(false)
    setError(null)
    try {
      const res = await fetch("/api/send-support-mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, subject, message })
      })
      const data = await res.json()
      if (data.success) {
        setSuccess(true)
        setEmail("")
        setSubject("")
        setMessage("")
      } else {
        setError(data.error || "Erreur lors de l'envoi du mail.")
      }
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'envoi du mail.")
    }
    setLoading(false)
  }

  return (
    <Layout title="Centre d'aide & Découverte" subtitle="Comprenez et exploitez toutes les fonctionnalités de l'application">
      <div className="w-full min-h-[80vh] flex flex-col items-center justify-start bg-sidebar py-8 px-2" style={{ backgroundColor: "hsl(var(--sidebar-background))" }}>
        <div className="max-w-3xl w-full text-center mb-10">
          <div className="flex justify-center mb-4">
            <LifeBuoy className="h-14 w-14 text-blue-400" />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-gist-blue mb-2">Bienvenue sur GIST Connect !</h1>
          <p className="text-lg md:text-xl text-gray-700">Votre assistant IA pour la gestion de projet SNCF. Découvrez comment tirer le meilleur parti de la plateforme.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full max-w-6xl mb-12">
          {sections.map((section, idx) => (
            <Card key={idx} className="flex flex-col items-center p-6 shadow-lg hover:shadow-2xl transition-shadow border-2 border-blue-100 bg-white/95 rounded-2xl">
              <div className="mb-3">{section.icon}</div>
              <CardTitle className="text-xl font-bold text-center mb-2">{section.title}</CardTitle>
              <CardContent className="text-gray-600 text-center mb-4 p-0">{section.description}</CardContent>
              <Button asChild className="mt-auto bg-gist-blue hover:bg-gist-blue/90 text-white font-semibold px-6 py-2 rounded-lg">
                <a href={section.link}>{section.cta}</a>
              </Button>
            </Card>
          ))}
        </div>

        <div className="w-full max-w-4xl bg-white/90 rounded-xl shadow p-8 mb-12">
          <h2 className="text-2xl font-bold text-blue-700 mb-4 text-center">Premiers pas sur la plateforme</h2>
          <ol className="list-decimal list-inside space-y-2 text-gray-700 text-lg">
            {steps.map((step, idx) => (
              <li key={idx}>{step}</li>
            ))}
          </ol>
        </div>

        <div ref={formulaireRef} className="w-full max-w-5xl mb-12 mt-8">
          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <TabsList className="flex w-full justify-center gap-4 bg-transparent pt-6">
              <TabsTrigger value="formulaire" className="text-lg px-6">Formulaire d'aide</TabsTrigger>
              <TabsTrigger value="faq" className="text-lg px-6">Questions fréquentes</TabsTrigger>
            </TabsList>
            <TabsContent value="formulaire">
              <div className="bg-white/95 rounded-3xl border border-gray-200 shadow-2xl p-8 mt-6">
                <h2 className="text-3xl md:text-4xl font-extrabold text-center text-sncf-red mb-2">Demander de l'aide</h2>
                <p className="text-center text-gray-500 text-lg mb-4">Remplissez ce formulaire pour contacter l'équipe support</p>
                <form className="max-w-2xl mx-auto space-y-6" onSubmit={handleSupportSubmit}>
                  <div>
                    <label className="block font-medium mb-1">Votre email</label>
                    <input type="email" required className="w-full border rounded px-4 py-2" placeholder="votre.email@exemple.com" value={email} onChange={e => setEmail(e.target.value)} />
                  </div>
                  <div>
                    <label className="block font-medium mb-1">Sujet</label>
                    <input type="text" required className="w-full border rounded px-4 py-2" placeholder="Sujet de votre demande" value={subject} onChange={e => setSubject(e.target.value)} />
                  </div>
                  <div>
                    <label className="block font-medium mb-1">Message</label>
                    <textarea required className="w-full border rounded px-4 py-2 min-h-32" placeholder="Décrivez votre problème ou question..." value={message} onChange={e => setMessage(e.target.value)}></textarea>
                  </div>
                  {success && <div className="text-green-600 font-semibold">Votre demande a bien été envoyée !</div>}
                  {error && <div className="text-red-600 font-semibold">{error}</div>}
                  <div className="flex justify-end">
                    <Button type="submit" className="bg-gist-blue hover:bg-gist-blue/90 text-white px-10 py-3 text-lg rounded-md" disabled={loading}>{loading ? "Envoi..." : "Envoyer"}</Button>
                  </div>
                </form>
              </div>
            </TabsContent>
            <TabsContent value="faq">
              <div className="bg-white/95 rounded-3xl border border-gray-200 shadow-2xl p-8 mt-6">
                <h2 className="text-3xl md:text-4xl font-extrabold text-center text-sncf-red mb-2">Questions fréquentes</h2>
                <p className="text-center text-gray-500 text-lg mb-4">Retrouvez ici les réponses aux questions les plus courantes</p>
                <div className="space-y-8">
                  {faqs.map((faq, idx) => (
                    <div key={idx} className="border-b pb-6 last:border-b-0">
                      <h3 className="font-semibold text-lg text-gray-900 mb-2 flex items-center gap-2"><HelpCircle className="h-5 w-5 text-blue-400" />{faq.question}</h3>
                      <p className="text-gray-700 text-base ml-7">{faq.answer}</p>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  )
}
