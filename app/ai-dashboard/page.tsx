"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Download } from "lucide-react"
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from "chart.js"
import { Bar } from "react-chartjs-2"
ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend)

interface S3Document {
  name: string
  key: string
  size: string
  lastModified: string
  type: string
  url: string
}

export default function AiDashboardPage() {
  const [documents, setDocuments] = useState<S3Document[]>([])
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [dashboard, setDashboard] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchDocuments = async () => {
      const res = await fetch("/api/documents")
      const data = await res.json()
      setDocuments(data.documents || [])
    }
    fetchDocuments()
  }, [])

  const handleSelect = (key: string) => {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  const handleAnalyze = async () => {
    setLoading(true)
    setError(null)
    setDashboard(null)
    try {
      const res = await fetch("/api/ai-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys: selectedKeys }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setDashboard(data)
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'analyse IA")
    } finally {
      setLoading(false)
    }
  }

  // Téléchargement du résumé
  const handleDownloadSummary = () => {
    if (!dashboard?.detailedSummary) return
    const blob = new Blob([dashboard.detailedSummary], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "resume_ia.txt"
    a.click()
    URL.revokeObjectURL(url)
  }

  // Préparation des données pour le graphique (exemple: KPIs)
  const chartData = dashboard?.kpis && dashboard.kpis.length > 0 ? {
    labels: dashboard.kpis.map((k: any) => k.label),
    datasets: [
      {
        label: "Valeur",
        data: dashboard.kpis.map((k: any) => parseFloat(k.value) || 0),
        backgroundColor: "#e11d48",
      },
    ],
  } : null

  return (
    <div className="max-w-4xl mx-auto py-10">
      <Card>
        <CardHeader>
          <CardTitle>Dashboard IA à partir de vos documents</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div>
              <div className="mb-2 font-medium">Sélectionnez les documents à analyser :</div>
              <div className="max-h-64 overflow-y-auto border rounded p-2 bg-gray-50">
                {documents.length === 0 && <div className="text-gray-400">Aucun document disponible.</div>}
                {documents.map((doc) => (
                  <label key={doc.key} className="flex items-center gap-2 py-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedKeys.includes(doc.key)}
                      onChange={() => handleSelect(doc.key)}
                    />
                    <span className="font-medium text-gray-900">{doc.name}</span>
                    <span className="text-xs text-gray-500">({doc.size}, {doc.type}, {doc.lastModified})</span>
                  </label>
                ))}
              </div>
            </div>
            <Button onClick={handleAnalyze} disabled={selectedKeys.length === 0 || loading}>
              {loading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
              Analyser avec l'IA
            </Button>
            {error && <div className="text-red-600">{error}</div>}
          </div>
        </CardContent>
      </Card>

      {/* Affichage dynamique des widgets IA */}
      {dashboard && (
        <div className="mt-8 space-y-6">
          {dashboard.detailedSummary && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Résumé IA détaillé</CardTitle>
                <Button variant="outline" size="sm" onClick={handleDownloadSummary}>
                  <Download className="h-4 w-4 mr-1" /> Télécharger
                </Button>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-3 rounded border max-h-96 overflow-auto">{dashboard.detailedSummary}</pre>
              </CardContent>
            </Card>
          )}
          {dashboard.kpis && dashboard.kpis.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Indicateurs clés (KPIs)</CardTitle>
              </CardHeader>
              <CardContent>
                {chartData && (
                  <div className="mb-6">
                    <Bar data={chartData} options={{ responsive: true, plugins: { legend: { display: false } } }} />
                  </div>
                )}
                <ul>
                  {dashboard.kpis.map((kpi: any, idx: number) => (
                    <li key={idx} className="mb-2">
                      <strong>{kpi.label} :</strong> {kpi.value}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          {dashboard.people && dashboard.people.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Personnes mentionnées</CardTitle>
              </CardHeader>
              <CardContent>
                <ul>
                  {dashboard.people.map((person: any, idx: number) => (
                    <li key={idx} className="mb-2">
                      <strong>{person.name}</strong> — {person.status || "Statut inconnu"} {person.contact && (<span>({person.contact})</span>)}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          {dashboard.timeline && dashboard.timeline.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Timeline extraite</CardTitle>
              </CardHeader>
              <CardContent>
                <ul>
                  {dashboard.timeline.map((event: any, idx: number) => (
                    <li key={idx} className="mb-2">
                      <strong>{event.date || "Date inconnue"}</strong> — {event.label || event.name || "Événement"}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          {dashboard.alerts && dashboard.alerts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Alertes IA</CardTitle>
              </CardHeader>
              <CardContent>
                <ul>
                  {dashboard.alerts.map((alert: string, idx: number) => (
                    <li key={idx} className="text-red-600 mb-2">{alert}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
} 