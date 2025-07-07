"use client"

import { useEffect, useState } from "react"
import { Layout } from "@/components/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { CheckCircle, AlertCircle, CalendarIcon, Users, Target, FileText, Building, BookOpen, Flag, ListTodo, User, Mail, Phone, FileArchive, ShieldAlert } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Pie } from "react-chartjs-2"
import { Chart, ArcElement, Tooltip, Legend } from "chart.js"
Chart.register(ArcElement, Tooltip, Legend)

function fallbackProjectData() {
  return {
    projectName: "Projet inconnu",
    projectId: "-",
    projectManager: { name: "-", email: "", telephone: "", entite: "" },
    client: { nom: "-", contact: "" },
    description: "Aucune description disponible.",
    objectifs: [],
    avancement: { etat: "inconnu", percent: null, resume: "" },
    budget: { total: null, usedPercent: null, reste: null, alertes: null },
    periode: { start: "-", end: "-", datesCles: [] },
    phases: [],
    jalons: [],
    risques: [],
    pointsBlocage: [],
    prochainesActions: [],
    livrables: [],
    partiesPrenantes: [],
    contactsUtiles: [],
    alertes: [],
    autres: null,
  }
}

function fallbackMilestones() {
  return []
}

export default function ProjectSummaryPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [project, setProject] = useState<any>(null)
  const [raw, setRaw] = useState<any>(null)
  const [fileName, setFileName] = useState<string>("")
  const [refreshFlag, setRefreshFlag] = useState(0)

  // Durée de validité du cache (ms)
  const CACHE_DURATION = 30 * 60 * 1000 // 30 minutes

  useEffect(() => {
    async function fetchSummary() {
      setLoading(true)
      setError(null)
      setProject(null)
      setRaw(null)
      setFileName("")
      // 1. Vérifier le cache localStorage
      const cacheStr = typeof window !== "undefined" ? localStorage.getItem("projectSummaryCache") : null
      let cache: any = null
      if (cacheStr) {
        try { cache = JSON.parse(cacheStr) } catch {}
      }
      const now = Date.now()
      if (cache && cache.data && cache.timestamp && (now - cache.timestamp < CACHE_DURATION)) {
        // Utiliser le cache
        const data = cache.data
        // ... logique de filtrage fichier ...
        const found = data.summaries.find((item: any) =>
          item.file &&
          /rapport complet|présentation du projet/i.test(item.file)
        )
        if (!found) {
          setError("Aucun fichier 'rapport complet' ou 'présentation du projet' trouvé dans le bucket.")
          setLoading(false)
          return
        }
        setFileName(found.file)
        setRaw(found)
        setProject({ ...fallbackProjectData(), ...(found.summary || {}) })
        setLoading(false)
        return
      }
      // 2. Sinon, fetch l'API
      try {
        const res = await fetch("/api/project-summary")
        const data = await res.json()
        if (data.error) {
          setError(data.error)
          setLoading(false)
          return
        }
        if (!data.summaries || !Array.isArray(data.summaries) || data.summaries.length === 0) {
          setError("Aucun résumé de projet trouvé.")
          setLoading(false)
          return
        }
        // Mettre à jour le cache
        if (typeof window !== "undefined") {
          localStorage.setItem("projectSummaryCache", JSON.stringify({ data, timestamp: Date.now() }))
        }
        // Filtrer le fichier dont le titre contient 'rapport complet' ou 'présentation du projet'
        const found = data.summaries.find((item: any) =>
          item.file &&
          /rapport complet|présentation du projet/i.test(item.file)
        )
        if (!found) {
          setError("Aucun fichier 'rapport complet' ou 'présentation du projet' trouvé dans le bucket.")
          setLoading(false)
          return
        }
        setFileName(found.file)
        setRaw(found)
        setProject({ ...fallbackProjectData(), ...(found.summary || {}) })
      } catch (e: any) {
        setError(e.message || "Erreur inconnue")
      } finally {
        setLoading(false)
      }
    }
    fetchSummary()
    // eslint-disable-next-line
  }, [refreshFlag])

  // Bouton pour forcer le refresh
  function handleRefresh() {
    if (typeof window !== "undefined") {
      localStorage.removeItem("projectSummaryCache")
    }
    setRefreshFlag(f => f + 1)
  }

  if (loading) {
    return (
      <Layout title="Résumé du projet" subtitle="Chargement automatique...">
        <div className="p-8 text-center text-gray-500">Chargement du rapport complet ou de la présentation du projet...</div>
      </Layout>
    )
  }

  if (error) {
    return (
      <Layout title="Résumé du projet" subtitle="Erreur">
        <div className="p-8 text-center text-red-500">{error}</div>
      </Layout>
    )
  }

  const globalSummary = typeof project?.globalSummary === "string"
    ? project.globalSummary
    : (project?.globalSummary?.toString() || "Aucun résumé global généré.");
  // KPIs
  const kpiList = [
    { label: "Avancement", value: project.avancement?.percent ?? 0, icon: <Target className="h-5 w-5 text-green-600" />, color: "bg-green-100 text-green-800" },
    { label: "Budget utilisé", value: project.budget?.usedPercent ?? 0, icon: <Building className="h-5 w-5 text-yellow-600" />, color: "bg-yellow-100 text-yellow-800" },
    { label: "Risques", value: Array.isArray(project.risques) ? project.risques.length : 0, icon: <ShieldAlert className="h-5 w-5 text-red-600" />, color: "bg-red-100 text-red-800" },
    { label: "Jalons", value: Array.isArray(project.jalons) ? project.jalons.length : 0, icon: <Flag className="h-5 w-5 text-blue-600" />, color: "bg-blue-100 text-blue-800" },
  ]

  // Timeline data (phases + jalons)
  const timeline = [
    ...(Array.isArray(project.phases) ? project.phases.map((p: any) => ({
      type: "phase",
      label: p.nom || p.name || "Phase",
      date: p.date,
      statut: p.statut,
      color: "#6366f1"
    })) : []),
    ...(Array.isArray(project.jalons) ? project.jalons.map((j: any) => ({
      type: "jalon",
      label: j.nom || j.name || "Jalon",
      date: j.date,
      statut: j.statut,
      color: j.criticite === "élevée" ? "#ef4444" : j.criticite === "moyenne" ? "#f59e42" : "#10b981"
    })) : [])
  ].sort((a, b) => (a.date || "").localeCompare(b.date || ""))

  // Risques critiques (top 3 par criticité)
  const risquesCritiques = (Array.isArray(project.risques) ? [...project.risques] : [])
    .sort((a, b) => (b.criticite || "").localeCompare(a.criticite || ""))
    .slice(0, 3)

  // Contacts clés (chef de projet, client, parties prenantes principales)
  const contacts = [
    { ...project.projectManager, role: "Chef de projet" },
    ...(project.client?.contact ? [{ ...project.client, role: "Client" }] : []),
    ...(Array.isArray(project.partiesPrenantes) ? project.partiesPrenantes.slice(0, 3) : [])
  ]

  // Budget donut data
  const budgetUsed = Number(project.budget?.usedPercent) || 0
  const budgetRestant = 100 - budgetUsed
  const budgetData = {
    labels: ["Utilisé", "Restant"],
    datasets: [
      {
        data: [budgetUsed, budgetRestant],
        backgroundColor: ["#facc15", "#e5e7eb"],
        borderWidth: 0
      }
    ]
  }

  return (
    <Layout title="Résumé du projet" subtitle={fileName ? `Fichier analysé : ${fileName}` : undefined}>
      <div className="mx-auto max-w-6xl w-full flex flex-col gap-8 py-8 px-2 md:px-0">
        <div className="flex justify-end mb-2">
          <button onClick={handleRefresh} className="px-4 py-2 rounded bg-blue-100 text-blue-800 font-semibold hover:bg-blue-200 transition">Rafraîchir</button>
        </div>
        {/* Widget Résumé global */}
        <div className="bg-green-50 border border-green-200 rounded p-6 shadow-sm mb-2">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="h-6 w-6 text-green-700" />
            <span className="text-xl font-bold text-green-900">Résumé global du projet</span>
          </div>
          <div className="text-gray-900 text-base whitespace-pre-line">{globalSummary}</div>
        </div>
        {/* Widgets synthétiques (affichés seulement si infos structurées présentes) */}
        {(project.projectName !== "Projet inconnu" || project.objectifs.length > 0 || project.risques.length > 0) && (
        <>
        {/* KPIs synthèse */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-blue-50 border border-blue-100 rounded p-6 shadow-sm">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <FileText className="h-7 w-7 text-blue-500" />
              <span className="text-2xl font-bold text-blue-900">{project.projectName}</span>
              <Badge variant="outline">ID : {project.projectId}</Badge>
            </div>
            <div className="flex flex-wrap gap-2 items-center text-sm">
              <span className="text-gray-700">Chef de projet : <b>{project.projectManager?.nom || project.projectManager?.name || "-"}</b>{project.projectManager?.email && (<span className="ml-2 text-xs text-blue-600">{project.projectManager.email}</span>)}{project.projectManager?.téléphone && (<span className="ml-2 text-xs text-green-600">{project.projectManager.téléphone}</span>)}{project.projectManager?.entité && (<span className="ml-2 text-xs text-gray-500">{project.projectManager.entité}</span>)}</span>
              <span className="text-gray-700">Client : <b>{typeof project.client === "object"
                ? project.client.nom || project.client.name || ""
                : project.client}</b>
                {project.client && typeof project.client === "object" && project.client.contact && (
                  <span className="ml-2 text-xs text-blue-600">{project.client.contact}</span>
                )}
              </span>
              {project.periode?.start && <span className="text-gray-700">Début : {project.periode.start}</span>}
              {project.periode?.end && <span className="text-gray-700">Fin : {project.periode.end}</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-4 items-center justify-end">
            {kpiList.map((k, i) => (
              <div key={i} className={`flex flex-col items-center px-4 py-2 rounded ${k.color} min-w-[90px]`}>
                <div>{k.icon}</div>
                <div className="text-lg font-bold">{k.value}{k.label.includes("%") ? "%" : ""}</div>
                <div className="text-xs font-semibold">{k.label}</div>
              </div>
            ))}
          </div>
        </div>
        {/* Widgets row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Widget Budget */}
          <div className="bg-white rounded border p-6 shadow-sm flex flex-col items-center">
            <div className="font-semibold mb-2 flex items-center gap-2"><Building className="h-5 w-5 text-yellow-600" /> Budget</div>
            <div className="w-32 h-32 flex items-center justify-center relative">
              {/* Donut chart */}
              <Pie data={budgetData} options={{ cutout: "70%", plugins: { legend: { display: false } } }} />
              <div className="absolute text-xl font-bold text-yellow-700 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">{budgetUsed}%</div>
            </div>
            <div className="text-xs text-gray-500 mt-2">{project.budget?.total ? `Total : ${project.budget.total}` : "Total inconnu"}</div>
          </div>
          {/* Widget Risques critiques */}
          <div className="bg-white rounded border p-6 shadow-sm">
            <div className="font-semibold mb-2 flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-red-600" /> Risques critiques</div>
            {risquesCritiques.length > 0 ? (
              <ul className="space-y-2">
                {risquesCritiques.map((r: any, i: number) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className={`inline-block w-3 h-3 rounded-full ${r.criticite === "élevée" ? "bg-red-500" : r.criticite === "moyenne" ? "bg-orange-400" : "bg-green-500"}`}></span>
                    <span className="font-semibold">{r.description || r}</span>
                    {r.responsable && <span className="text-xs text-gray-500 ml-2">({r.responsable})</span>}
                  </li>
                ))}
              </ul>
            ) : <div className="text-gray-500 text-sm">Aucun risque critique détecté.</div>}
          </div>
          {/* Widget Contacts clés */}
          <div className="bg-white rounded border p-6 shadow-sm">
            <div className="font-semibold mb-2 flex items-center gap-2"><Users className="h-5 w-5 text-purple-600" /> Contacts clés</div>
            <ul className="space-y-2">
              {contacts.map((c, i) => (
                <li key={i} className="flex items-center gap-2">
                  <User className="h-5 w-5 text-blue-500" />
                  <span className="font-semibold">{c.name || c.nom || "-"}</span>
                  {c.role && <span className="ml-2 text-xs text-gray-500">{c.role}</span>}
                  {c.email && <Mail className="h-4 w-4 text-gray-400 ml-2" />}<span className="text-xs text-blue-600">{c.email}</span>
                  {c.telephone && <Phone className="h-4 w-4 text-gray-400 ml-2" />}<span className="text-xs text-green-600">{c.telephone}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        {/* Timeline */}
        <div className="bg-white rounded border p-6 shadow-sm">
          <div className="font-semibold mb-4 flex items-center gap-2"><CalendarIcon className="h-5 w-5 text-purple-600" /> Timeline projet</div>
          <div className="flex flex-col md:flex-row gap-4 items-center">
            {timeline.length > 0 ? timeline.map((t, i) => (
              <div key={i} className="flex flex-col items-center">
                <div className="w-3 h-3 rounded-full" style={{ background: t.color }}></div>
                <div className="text-xs mt-1 font-semibold" style={{ color: t.color }}>{t.label}</div>
                <div className="text-xs text-gray-500">{t.date}</div>
                {i < timeline.length - 1 && <div className="h-8 w-0.5 bg-gray-300 mx-auto"></div>}
              </div>
            )) : <div className="text-gray-500 text-sm">Aucune phase ou jalon détecté.</div>}
          </div>
        </div>
        {/* Blocages & alertes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded border p-6 shadow-sm">
            <div className="font-semibold mb-2 flex items-center gap-2"><AlertCircle className="h-5 w-5 text-red-600" /> Blocages</div>
            {Array.isArray(project.pointsBlocage) && project.pointsBlocage.length > 0 ? (
              <ul className="list-disc pl-6 text-sm">
                {project.pointsBlocage.map((b: any, i: number) => <li key={i}>{typeof b === "string" ? b : JSON.stringify(b)}</li>)}
              </ul>
            ) : <div className="text-gray-500 text-sm">Aucun blocage détecté.</div>}
          </div>
          <div className="bg-white rounded border p-6 shadow-sm">
            <div className="font-semibold mb-2 flex items-center gap-2"><AlertCircle className="h-5 w-5 text-orange-500" /> Alertes</div>
            {Array.isArray(project.alertes) && project.alertes.length > 0 ? (
              <ul className="list-disc pl-6 text-sm">
                {project.alertes.map((a: any, i: number) => <li key={i}>{typeof a === "string" ? a : JSON.stringify(a)}</li>)}
              </ul>
            ) : <div className="text-gray-500 text-sm">Aucune alerte détectée.</div>}
          </div>
        </div>
        {/* Prochaines actions & livrables */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded border p-6 shadow-sm">
            <div className="font-semibold mb-2 flex items-center gap-2"><ListTodo className="h-5 w-5 text-green-600" /> Prochaines actions</div>
            {Array.isArray(project.prochainesActions) && project.prochainesActions.length > 0 ? (
              <ul className="list-disc pl-6 text-sm">
                {project.prochainesActions.map((a: any, i: number) => <li key={i}>{typeof a === "string" ? a : JSON.stringify(a)}</li>)}
              </ul>
            ) : <div className="text-gray-500 text-sm">Aucune action détectée.</div>}
          </div>
          <div className="bg-white rounded border p-6 shadow-sm">
            <div className="font-semibold mb-2 flex items-center gap-2"><FileArchive className="h-5 w-5 text-blue-600" /> Livrables</div>
            {Array.isArray(project.livrables) && project.livrables.length > 0 ? (
              <ul className="list-disc pl-6 text-sm">
                {project.livrables.map((l: any, i: number) => <li key={i}>{typeof l === "string" ? l : JSON.stringify(l)}</li>)}
              </ul>
            ) : <div className="text-gray-500 text-sm">Aucun livrable détecté.</div>}
          </div>
        </div>
        {/* Description & objectifs (en bas pour la complétude) */}
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-1 bg-white rounded border p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-2"><BookOpen className="h-5 w-5 text-green-600" /><span className="font-semibold">Description</span></div>
            <div className="text-gray-800 whitespace-pre-line text-sm">{project.description}</div>
          </div>
          <div className="flex-1 bg-white rounded border p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-2"><CheckCircle className="h-5 w-5 text-blue-600" /><span className="font-semibold">Objectifs</span></div>
            {Array.isArray(project.objectifs) && project.objectifs.length > 0 ? (
              <ul className="list-disc pl-6 text-sm">
                {project.objectifs.map((o: string, i: number) => <li key={i}>{o}</li>)}
              </ul>
            ) : <div className="text-gray-500 text-sm">Aucun objectif détecté.</div>}
          </div>
        </div>
        </>)}
        {/* JSON brut */}
        <div className="mt-10 w-full">
          <details>
            <summary className="cursor-pointer text-xs text-gray-400">Voir la réponse JSON complète</summary>
            <pre className="bg-gray-100 rounded p-2 text-xs mt-2 overflow-x-auto">{JSON.stringify(raw, null, 2)}</pre>
          </details>
        </div>
      </div>
    </Layout>
  )
}
