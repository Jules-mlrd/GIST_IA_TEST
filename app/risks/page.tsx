"use client"

import { Layout } from "@/components/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AlertTriangle, PlusCircle, ArrowUpDown, Calendar, Trash2 } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { useEffect, useState } from "react"

const RISKS_CACHE_KEY = 'risks_cache_v1';
const RISKS_CACHE_EXPIRATION_MS = 10 * 60 * 1000; // 10 minutes
const RISKS_BLACKLIST_KEY = 'risks_blacklist_v1';

export default function RisksPage() {
  const [risks, setRisks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ description: "", criticite: "", responsable: "", action: "" })
  const [formError, setFormError] = useState<string | null>(null)
  const [formLoading, setFormLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [blacklist, setBlacklist] = useState<string[]>([])

  const fetchRisks = async () => {
    setLoading(true)
    setError(null)
    try {
      // Vérifier le cache localStorage
      const cached = typeof window !== 'undefined' ? localStorage.getItem(RISKS_CACHE_KEY) : null;
      if (cached) {
        const { risks: cachedRisks, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < RISKS_CACHE_EXPIRATION_MS) {
          setRisks(cachedRisks || []);
          setLoading(false);
          return;
        }
      }
      // Sinon, appel API
      const res = await fetch("/api/risks")
      if (!res.ok) throw new Error("Erreur lors de la récupération des risques")
      const data = await res.json()
      setRisks(data.risks || [])
      // Mettre à jour le cache
      if (typeof window !== 'undefined') {
        localStorage.setItem(RISKS_CACHE_KEY, JSON.stringify({ risks: data.risks || [], timestamp: Date.now() }))
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRisks()
  }, [])

  // Charger la blacklist au montage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const bl = localStorage.getItem(RISKS_BLACKLIST_KEY)
      if (bl) setBlacklist(JSON.parse(bl))
    }
  }, [])

  // Mapping pour affichage (fallback si champ manquant)
  function getSeverity(criticite?: string) {
    if (!criticite) return 'secondary'
    if (/élevée|high/i.test(criticite)) return 'destructive'
    if (/moyenne|medium/i.test(criticite)) return 'default'
    return 'secondary'
  }

  function normalizeCriticite(criticite?: string) {
    if (!criticite) return "faible";
    const crit = criticite.toLowerCase();
    if (/critique|extreme|extrême|critical|urgent|bloquant/.test(crit)) return "critique";
    if (/élevée|haute|high|important|majeur|major|orange/.test(crit)) return "élevé";
    if (/moyenne|medium|modéré|modere|jaune|moyen/.test(crit)) return "moyen";
    if (/faible|low|mineur|minor|vert/.test(crit)) return "faible";
    return "faible";
  }

  function getSeverityColor(criticite?: string) {
    const norm = normalizeCriticite(criticite);
    if (norm === "critique") return { variant: "destructive", className: "" };
    if (norm === "élevé") return { variant: "default", className: "bg-orange-400 text-white" };
    if (norm === "moyen") return { variant: "default", className: "bg-yellow-300 text-gray-900" };
    return { variant: "default", className: "bg-green-500 text-white" };
  }

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleAddRisk = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!form.description) {
      setFormError("Description requise.")
      return
    }
    setFormLoading(true)
    try {
      const res = await fetch("/api/risks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      })
      if (!res.ok) {
        const data = await res.json()
        setFormError(data.error || "Erreur lors de l'ajout")
      } else {
        setShowForm(false)
        setForm({ description: "", criticite: "", responsable: "", action: "" })
        await fetchRisks()
      }
    } catch {
      setFormError("Erreur lors de l'ajout")
    } finally {
      setFormLoading(false)
    }
  }

  const handleDeleteRisk = async (risk: any) => {
    setDeleteLoading(risk.id || risk.description)
    try {
      if (risk.id) {
        // Suppression réelle pour les risques manuels
        await fetch('/api/risks', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: risk.id, description: risk.description })
        })
        // Vider le cache localStorage pour forcer le rechargement depuis l'API
        if (typeof window !== 'undefined') {
          localStorage.removeItem(RISKS_CACHE_KEY)
        }
        await fetchRisks()
      } else {
        // Suppression locale (blacklist) pour les risques IA
        const newBlacklist = [...blacklist, risk.description]
        setBlacklist(newBlacklist)
        if (typeof window !== 'undefined') {
          localStorage.setItem(RISKS_BLACKLIST_KEY, JSON.stringify(newBlacklist))
        }
      }
    } finally {
      setDeleteLoading(null)
    }
  }

  const handleRefreshIA = async () => {
    setRefreshing(true)
    try {
      await fetch('/api/risks/refresh', { method: 'POST' })
      // Vider la blacklist locale
      setBlacklist([])
      if (typeof window !== 'undefined') {
        localStorage.removeItem(RISKS_BLACKLIST_KEY)
      }
      await fetchRisks()
    } finally {
      setRefreshing(false)
    }
  }

  // Un risque manuel a un id (ajouté via POST)
  function isManualRisk(risk: any) {
    return !!risk.id
  }

  // Filtrer les risques blacklistés (IA)
  const displayedRisks = risks.filter(risk => !blacklist.includes(risk.description))

  return (
    <Layout title="Risques" subtitle="Gestion des risques du projet">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <Badge variant="destructive" className="rounded-sm">
            {risks.filter((risk) => (risk.status || '').toLowerCase() === "open" || (risk.criticite || '').toLowerCase() === "élevée").length} Risques actifs
          </Badge>
          <Badge variant="outline" className="rounded-sm">
            {risks.filter((risk) => (risk.status || '').toLowerCase() === "mitigating" || (risk.criticite || '').toLowerCase() === "moyenne").length} En atténuation
          </Badge>
          <Badge variant="secondary" className="rounded-sm">
            {risks.filter((risk) => (risk.status || '').toLowerCase() === "closed" || (risk.criticite || '').toLowerCase() === "faible").length} Résolus
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button className="bg-sncf-red hover:bg-red-700" onClick={() => setShowForm(v => !v)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Ajouter un risque
          </Button>
          <Button variant="outline" onClick={handleRefreshIA} disabled={refreshing}>
            {refreshing ? "Rafraîchissement..." : "Rafraîchir IA"}
          </Button>
        </div>
      </div>
      {showForm && (
        <form onSubmit={handleAddRisk} className="mb-6 p-4 border rounded bg-gray-50 flex flex-col gap-2 max-w-xl">
          <div className="flex gap-2">
            <input name="description" placeholder="Description" value={form.description} onChange={handleFormChange} className="flex-1 border rounded px-2 py-1" />
            <input name="criticite" placeholder="Criticité" value={form.criticite} onChange={handleFormChange} className="flex-1 border rounded px-2 py-1" />
          </div>
          <div className="flex gap-2">
            <input name="responsable" placeholder="Responsable" value={form.responsable} onChange={handleFormChange} className="flex-1 border rounded px-2 py-1" />
            <input name="action" placeholder="Action" value={form.action} onChange={handleFormChange} className="flex-1 border rounded px-2 py-1" />
          </div>
          {formError && <div className="text-red-600 text-sm">{formError}</div>}
          <div className="flex gap-2 mt-2">
            <Button type="submit" className="bg-sncf-red" disabled={formLoading}>
              {formLoading ? "Ajout..." : "Ajouter"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setShowForm(false)} disabled={formLoading}>
              Annuler
            </Button>
          </div>
        </form>
      )}
      {loading && <div>Chargement des risques...</div>}
      {error && <div className="text-red-600">{error}</div>}
      {!loading && !error && (
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
                  <TableHead className="w-[50px]">#</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Criticité</TableHead>
                  <TableHead>Responsable</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Supprimer</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedRisks.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6}>Aucun risque trouvé dans les documents.</TableCell>
                  </TableRow>
                )}
                {displayedRisks.map((risk, idx) => {
                  const sev = getSeverityColor(risk.criticite);
                  return (
                    <TableRow key={risk.id || idx}>
                      <TableCell className="font-medium">{idx + 1}</TableCell>
                      <TableCell>{risk.description || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={sev.variant as 'default' | 'destructive' | 'secondary' | 'outline'} className={sev.className}>
                          {normalizeCriticite(risk.criticite) || "-"}
                        </Badge>
                      </TableCell>
                      <TableCell>{risk.responsable || "-"}</TableCell>
                      <TableCell>{risk.action || "-"}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-600 hover:bg-red-100"
                          onClick={() => handleDeleteRisk(risk)}
                          disabled={deleteLoading === (risk.id || risk.description)}
                          title="Supprimer ce risque"
                          aria-label="Supprimer ce risque"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </Layout>
  )
}
