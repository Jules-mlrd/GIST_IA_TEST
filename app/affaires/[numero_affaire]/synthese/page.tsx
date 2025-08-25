"use client"

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, BookOpen, ListChecks, Info, Users, AlertTriangle, Clock, Mail, Phone } from "lucide-react";
import { useParams } from "next/navigation";
import AffaireNav from "@/components/AffaireNav";
import { marked } from "marked";
import DOMPurify from 'dompurify';
import { ChatBot } from "@/components/chatbot";

export default function SyntheseAffairePage() {
  const { numero_affaire } = useParams() as { numero_affaire: string };
  // Synthèse IA
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resume, setResume] = useState<string>("");
  const [bullets, setBullets] = useState<string[]>([]);
  const [bulletsByCategory, setBulletsByCategory] = useState<Record<string, string[]> | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [syntheseEtag, setSyntheseEtag] = useState<string | null>(null);
  // Contacts
  const [contacts, setContacts] = useState<any[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [errorContacts, setErrorContacts] = useState<string | null>(null);
  const [contactsEtag, setContactsEtag] = useState<string | null>(null);
  // Risques
  const [risks, setRisks] = useState<any[]>([]);
  const [loadingRisks, setLoadingRisks] = useState(true);
  const [errorRisks, setErrorRisks] = useState<string | null>(null);
  const [risksEtag, setRisksEtag] = useState<string | null>(null);
  const [refreshingRisks, setRefreshingRisks] = useState(false);
  // Timeline
  const [timeline, setTimeline] = useState<any[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(true);
  const [errorTimeline, setErrorTimeline] = useState<string | null>(null);
  const [timelineEtag, setTimelineEtag] = useState<string | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  // Ajouter un état pour les détails de debug IA
  const [risksDebug, setRisksDebug] = useState<any[]>([]);
  const [refreshingTimeline, setRefreshingTimeline] = useState(false);

  // Synthèse IA
  const fetchSynthese = async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = {};
      if (syntheseEtag && !force) headers['If-None-Match'] = syntheseEtag;
      const res = await fetch(`/api/affaires/${numero_affaire}/synthese${force ? "?refresh=1" : ""}`, { headers });
      if (res.status === 304) {
        setLoading(false);
        setRefreshing(false);
        return; // Donnée inchangée, on garde l'affichage
      }
      if (!res.ok) throw new Error("Erreur lors de la récupération de la synthèse IA");
      const data = await res.json();
      setResume(data.resume || "");
      setBullets(data.bullets || []);
      setBulletsByCategory(data.bulletsByCategory || null);
      setSyntheseEtag(res.headers.get('etag'));
    } catch (e: any) {
      setError(e.message);
      setResume("");
      setBullets([]);
      setBulletsByCategory(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  // Contacts
  const fetchContacts = async (force = false) => {
    setLoadingContacts(true);
    setErrorContacts(null);
    try {
      const headers: Record<string, string> = {};
      if (contactsEtag && !force) headers['If-None-Match'] = contactsEtag;
      const res = await fetch(`/api/contacts?affaire=${numero_affaire}${force ? "&refresh=1" : ""}`, { headers });
      if (res.status === 304) {
        setLoadingContacts(false);
        return;
      }
      if (!res.ok) throw new Error("Erreur lors de la récupération des contacts");
      const data = await res.json();
      setContacts(data.contacts || []);
      setContactsEtag(res.headers.get('etag'));
    } catch (e: any) {
      setErrorContacts(e.message);
      setContacts([]);
    } finally {
      setLoadingContacts(false);
    }
  };
  // Risques
  const fetchRisks = async (force = false) => {
    setLoadingRisks(true);
    setErrorRisks(null);
    try {
      const headers: Record<string, string> = {};
      if (risksEtag && !force) headers['If-None-Match'] = risksEtag;
      const res = await fetch(`/api/risks?affaire=${numero_affaire}${force ? "&refresh=1" : ""}`, { headers });
      if (res.status === 304) {
        setLoadingRisks(false);
        return;
      }
      if (!res.ok) throw new Error("Erreur lors de la récupération des risques");
      const data = await res.json();
      setRisks(data.risks || []);
      setRisksEtag(res.headers.get('etag'));
    } catch (e: any) {
      setErrorRisks(e.message);
      setRisks([]);
    } finally {
      setLoadingRisks(false);
    }
  };
  const refreshRisksIA = async () => {
    setRefreshingRisks(true);
    try {
      const res = await fetch('/api/risks/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ affaire: numero_affaire })
      });
      const data = await res.json();
      await fetchRisks(true);
      setRisksDebug(data.details || []);
    } finally {
      setRefreshingRisks(false);
    }
  };
  // Timeline
  const fetchTimeline = async (force = false) => {
    setLoadingTimeline(true);
    setErrorTimeline(null);
    try {
      const headers: Record<string, string> = {};
      if (timelineEtag && !force) headers['If-None-Match'] = timelineEtag;
      const res = await fetch(`/api/affaires/${numero_affaire}/timeline${force ? "?refresh=1" : ""}`, { headers });
      if (res.status === 304) {
        setLoadingTimeline(false);
        return;
      }
      if (!res.ok) throw new Error("Erreur lors de la récupération de la timeline");
      const data = await res.json();
      setTimeline(data.timeline || []);
      setTasks(data.tasks || []);
      setTimelineEtag(res.headers.get('etag'));
    } catch (e: any) {
      setErrorTimeline(e.message);
      setTimeline([]);
      setTasks([]);
    } finally {
      setLoadingTimeline(false);
    }
  };

  useEffect(() => {
    if (numero_affaire) fetchSynthese();
    if (numero_affaire) fetchContacts();
    if (numero_affaire) fetchRisks();
    if (numero_affaire) fetchTimeline();
    // eslint-disable-next-line
  }, [numero_affaire]);

  // Ajout des fonctions utilitaires pour criticité (copiées de la page risques)
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

  // Ajout d'une fonction pour expliquer la criticité
  function criticiteExplanation(criticite: string) {
    switch (normalizeCriticite(criticite)) {
      case "critique":
        return "Critique : impact majeur, bloquant ou très probable (ex : Blocage total du projet, non-conformité légale, perte de données majeures, arrêt de production)";
      case "élevé":
        return "Élevé : impact important ou probabilité forte (ex : Retard de plusieurs semaines sur une tâche clé, dépendance fournisseur à risque)";
      case "moyen":
        return "Moyen : impact modéré ou probabilité moyenne (ex : Retard de quelques jours sur une tâche secondaire, oubli d'un livrable intermédiaire)";
      default:
        return "Faible : impact négligeable, très peu probable (ex : Erreur mineure sans conséquence, retard d'une journée sur une tâche non critique)";
    }
  }

  return (
    <div className="w-[90vw] max-w-none mx-auto py-8 px-2 md:px-8 animate-fade-in">
      <AffaireNav numero_affaire={numero_affaire} active="synthese" />
      {/* Bloc Synthèse IA détaillée + Points clés fusionnés */}
      <div className="mb-10">
        <Card className="shadow-xl border-0 bg-gradient-to-br from-white via-indigo-50 to-indigo-100 w-full animate-fade-in">
          <CardContent className="p-8 flex flex-col gap-8">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <BookOpen className="h-6 w-6 text-sncf-red" />
                <h2 className="text-lg font-bold text-sncf-red">Synthèse IA détaillée & Points clés</h2>
              </div>
              <Button
                variant="outline"
                className="flex items-center gap-2 border-sncf-red text-sncf-red hover:bg-sncf-red/10 hover:text-sncf-red hover:border-sncf-red transition"
                onClick={() => { setRefreshing(true); fetchSynthese(true); }}
                disabled={loading || refreshing}
                title="Rafraîchir la synthèse et les points clés"
              >
                {refreshing ? <Loader2 className="animate-spin h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
                Rafraîchir
              </Button>
            </div>
            {/* Synthèse IA détaillée */}
            {loading ? (
              <div className="flex items-center gap-2 text-gray-500"><Loader2 className="animate-spin h-5 w-5" /> Chargement de la synthèse IA...</div>
            ) : error ? (
              <div className="text-red-600 font-semibold text-base text-center min-h-[200px]">{error}</div>
            ) : (
              <div
                className="prose prose-lg prose-indigo max-w-none text-gray-900"
                style={{
                  marginTop: 0,
                  marginBottom: 0,
                }}
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(
                    String(marked.parse(typeof resume === 'string' ? resume : ''))
                      .replace(/<h2>/g, '<h2 style="margin-top:2.5rem;margin-bottom:1rem;font-size:1.5rem;font-weight:700;border-bottom:2px solid #6366f1;padding-bottom:0.25em;">')
                  )
                }}
              />
            )}
            {/* Points clés */}
            {loading ? (
              <div className="flex items-center gap-2 text-gray-500"><Loader2 className="animate-spin h-5 w-5" /> Chargement des points clés...</div>
            ) : bulletsByCategory && Object.keys(bulletsByCategory).length > 0 ? (
              <div className="space-y-6">
                {[
                  { key: 'points_cles', label: 'Points clés', color: 'text-indigo-700' },
                  { key: 'decisions', label: 'Décisions', color: 'text-blue-700' },
                  { key: 'actions_a_venir', label: 'Actions à venir', color: 'text-green-700' },
                  { key: 'blocages', label: 'Blocages', color: 'text-red-700' },
                ].map(({ key, label, color }) =>
                  Array.isArray(bulletsByCategory[key]) && bulletsByCategory[key].length > 0 ? (
                    <div key={key}>
                      <div className={`font-bold mb-1 ${color}`}>{label}</div>
                      <ul className="list-disc pl-6 text-base text-gray-900 space-y-2">
                        {bulletsByCategory[key].map((item: string, i: number) => (
                          <li key={i} className="hover:bg-indigo-100/80 rounded px-2 py-1 transition-colors cursor-pointer animate-fade-in" style={{animationDelay: `${i * 60}ms`}}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null
                )}
              </div>
            ) : bullets.length > 0 && !(bullets.length === 1 && (bullets[0].startsWith('{') || bullets[0].startsWith('Erreur'))) ? (
              <div className="space-y-6">
                {bullets.map((item: string, i: number) => (
                  <div key={i} className="hover:bg-indigo-100/80 rounded px-2 py-1 transition-colors cursor-pointer animate-fade-in" style={{animationDelay: `${i * 60}ms`}}>{item}</div>
                ))}
              </div>
            ) : (
              <div className="text-gray-400">Aucun point clé généré.</div>
            )}
          </CardContent>
        </Card>
      </div>
      {/* Bloc Timeline & Tâches IA (en bas) */}
      <div className="mb-10">
        <Card className="shadow-xl border-0 bg-gradient-to-br from-white via-purple-50 to-purple-100 w-full animate-fade-in">
          <CardContent className="p-8 flex flex-col gap-8">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Clock className="h-6 w-6 text-purple-700" />
                <h2 className="text-lg font-bold text-purple-700">Timeline & Tâches IA</h2>
              </div>
              <Button
                variant="outline"
                className="flex items-center gap-2 border-purple-700 text-purple-700 hover:bg-purple-100/10 hover:text-purple-700 hover:border-purple-700 transition"
                onClick={() => { setRefreshingTimeline(true); fetchTimeline(true); }}
                disabled={loadingTimeline || refreshingTimeline}
                title="Rafraîchir la timeline et les tâches"
              >
                {refreshingTimeline ? <Loader2 className="animate-spin h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
                Rafraîchir
              </Button>
            </div>
            {/* Timeline (jalons) */}
            {loadingTimeline ? (
              <div className="flex items-center gap-2 text-gray-500"><Loader2 className="animate-spin h-4 w-4" /> Chargement de la timeline...</div>
            ) : errorTimeline ? (
              <div className="text-red-600 font-semibold text-base">{errorTimeline}</div>
            ) : timeline.length === 0 ? (
              <div className="text-gray-400">Aucun événement dans la timeline.</div>
            ) : (
              <div className="relative mb-8">
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>
                <div className="space-y-8">
                  {timeline.map((milestone, index) => (
                    <div key={index} className="relative pl-10">
                      <div className="absolute left-0 top-1.5 flex items-center justify-center w-8 h-8 rounded-full bg-white border-2 border-gray-200">
                        <Clock className="h-5 w-5 text-purple-700" />
                      </div>
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                        <div>
                          <h3 className="text-lg font-medium text-gray-900">{milestone.label}</h3>
                          {milestone.description && <p className="text-sm text-gray-500 mt-1">{milestone.description}</p>}
                        </div>
                        <div className="mt-2 md:mt-0 md:ml-4">
                          <span className="inline-block bg-purple-100 text-purple-800 text-xs px-3 py-1 rounded-full">{milestone.date}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Tâches IA */}
            {loadingTimeline ? (
              <div className="flex items-center gap-2 text-gray-500"><Loader2 className="animate-spin h-4 w-4" /> Chargement des tâches...</div>
            ) : errorTimeline ? (
              <div className="text-red-600 font-semibold text-base">{errorTimeline}</div>
            ) : tasks.length === 0 ? (
              <div className="text-gray-400">Aucune tâche détectée pour cette affaire.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tasks.map((task, idx) => (
                  <div key={task.id || idx} className={`p-4 border rounded-lg ${
                    task.status === "completed"
                      ? "bg-green-50 border-green-200"
                      : task.status === "in-progress"
                      ? "bg-yellow-50 border-yellow-200"
                      : "bg-gray-50 border-gray-200"
                  }`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-500">{task.id}</span>
                          <h3 className="font-medium text-gray-900">{task.name}</h3>
                        </div>
                        {task.assignee && <p className="text-sm text-gray-500 mt-1">Assigné à: {task.assignee}</p>}
                        {task.description && <p className="text-xs text-gray-400 mt-1">{task.description}</p>}
                      </div>
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                          task.status === "completed"
                            ? "bg-green-200 text-green-800"
                            : task.status === "in-progress"
                            ? "bg-yellow-200 text-yellow-800"
                            : "bg-gray-200 text-gray-800"
                        }`}
                      >
                        {task.status === "completed"
                          ? "Terminé"
                          : task.status === "in-progress"
                          ? "En cours"
                          : "À venir"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
                      <Clock className="h-3 w-3" />
                      <span>
                        {task.startDate || "?"} - {task.endDate || "?"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      {/* Bloc contacts */}
      <div className="mb-10">
        <Card className="shadow-xl border-0 bg-gradient-to-br from-white via-green-50 to-green-100 w-full animate-fade-in">
          <CardContent className="p-8 flex flex-col gap-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Users className="h-6 w-6 text-green-700" />
                <h2 className="text-lg font-bold text-green-700">Contacts de l'affaire</h2>
              </div>
              <Button
                variant="outline"
                className="flex items-center gap-2 border-green-700 text-green-700 hover:bg-green-100/10 hover:text-green-700 hover:border-green-700 transition"
                onClick={() => { setLoadingContacts(true); fetchContacts(true); }}
                disabled={loadingContacts}
                title="Rafraîchir les contacts"
              >
                {loadingContacts ? <Loader2 className="animate-spin h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
                Rafraîchir
              </Button>
            </div>
            {loadingContacts ? (
              <div className="flex items-center gap-2 text-gray-500"><Loader2 className="animate-spin h-4 w-4" /> Chargement des contacts...</div>
            ) : errorContacts ? (
              <div className="text-red-600 font-semibold text-base">{errorContacts}</div>
            ) : contacts.length === 0 ? (
              <div className="text-gray-400">Aucun contact trouvé.</div>
            ) : (
              <ul className="space-y-4">
                {contacts.map((c, i) => (
                  <li key={i} className="flex flex-col md:flex-row md:items-center md:gap-6 bg-white/80 rounded-lg p-4 border border-green-100 shadow-sm">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-base text-green-900 truncate">{c.prenom} {c.nom}</div>
                      {c.role && <div className="text-sm text-green-700 font-medium truncate">{c.role}</div>}
                      {c.societe && <div className="text-sm text-gray-500 truncate">{c.societe}</div>}
                    </div>
                    <div className="flex flex-col gap-1 mt-2 md:mt-0 md:items-end">
                      {c.email && (
                        <a href={`mailto:${c.email}`} className="flex items-center gap-1 text-blue-700 hover:underline text-sm">
                          <Mail className="h-4 w-4" /> {c.email}
                        </a>
                      )}
                      {c.telephone && (
                        <a href={`tel:${c.telephone}`} className="flex items-center gap-1 text-green-800 hover:underline text-sm">
                          <Phone className="h-4 w-4" /> {c.telephone}
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
      {/* Bloc risques */}
      <div className="mb-10">
        <Card className="shadow-xl border-0 bg-gradient-to-br from-white via-orange-50 to-orange-100 w-full animate-fade-in">
          <CardContent className="p-8 flex flex-col gap-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-6 w-6 text-orange-600" />
                <h2 className="text-lg font-bold text-orange-600">Risques de l'affaire</h2>
              </div>
              <Button
                variant="outline"
                className="flex items-center gap-2 border-orange-600 text-orange-600 hover:bg-orange-100/10 hover:text-orange-600 hover:border-orange-600 transition"
                onClick={refreshRisksIA}
                disabled={refreshingRisks}
                title="Rafraîchir les risques"
              >
                {refreshingRisks ? <Loader2 className="animate-spin h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
                Rafraîchir
              </Button>
            </div>
            {/* Badges de synthèse par criticité */}
            <div className="flex items-center gap-2 mb-4">
              {[
                { key: "critique", color: "bg-red-700 text-white", label: "Critiques" },
                { key: "élevé", color: "bg-orange-500 text-white", label: "Élevés" },
                { key: "moyen", color: "bg-yellow-300 text-gray-900", label: "Moyens" },
                { key: "faible", color: "bg-green-500 text-white", label: "Faibles" },
              ].map(({ key, color, label }) => (
                <span
                  key={key}
                  className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${color}`}
                  title={criticiteExplanation(key)}
                >
                  {risks.filter((risk) => normalizeCriticite(risk.criticite) === key).length} {label}
                </span>
              ))}
            </div>
            {loadingRisks ? (
              <div className="flex items-center gap-2 text-gray-500"><Loader2 className="animate-spin h-4 w-4" /> Chargement des risques...</div>
            ) : errorRisks ? (
              <div className="text-red-600 font-semibold text-base">{errorRisks}</div>
            ) : risks.length === 0 ? (
              <div className="text-gray-400">Aucun risque détecté.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border rounded bg-white/80">
                  <thead>
                    <tr>
                      <th className="px-2 py-1 border-b text-left text-xs font-semibold">#</th>
                      <th className="px-2 py-1 border-b text-left text-xs font-semibold">Description</th>
                      <th className="px-2 py-1 border-b text-left text-xs font-semibold">Criticité</th>
                      <th className="px-2 py-1 border-b text-left text-xs font-semibold">Responsable</th>
                      <th className="px-2 py-1 border-b text-left text-xs font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {risks
                      .slice()
                      .sort((a, b) => {
                        const order = { "critique": 3, "élevé": 2, "moyen": 1, "faible": 0 };
                        return order[normalizeCriticite(b.criticite)] - order[normalizeCriticite(a.criticite)];
                      })
                      .map((risk, idx) => {
                        const sev = getSeverityColor(risk.criticite);
                        const normCrit = normalizeCriticite(risk.criticite);
                        return (
                          <tr key={risk.id || idx} className="border-b last:border-b-0">
                            <td className="px-2 py-1 text-xs text-gray-700">{idx + 1}</td>
                            <td className="px-2 py-1 text-sm">{risk.description || "-"}</td>
                            <td className="px-2 py-1">
                              <span
                                className={`inline-block px-2 py-1 rounded text-xs font-semibold ${sev.className}`}
                                title={criticiteExplanation(normCrit)}
                              >
                                {normCrit}
                              </span>
                            </td>
                            <td className="px-2 py-1 text-sm">{risk.responsable || "-"}</td>
                            <td className="px-2 py-1 text-sm">{risk.action || "-"}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      {/* Encart à propos */}
      <div className="mt-12 max-w-3xl mx-auto bg-white/80 border border-indigo-100 rounded-xl shadow p-6 flex items-start gap-4 animate-fade-in">
        <Info className="h-7 w-7 text-indigo-600 mt-1" />
        <div>
          <div className="font-bold text-indigo-800 mb-1">À propos de cette synthèse IA</div>
          <div className="text-gray-700 text-sm leading-relaxed">
            Cette synthèse est générée automatiquement à partir des documents de l'affaire grâce à l'intelligence artificielle (GPT-4).<br />
            Elle vise à fournir une vue d'ensemble claire et exploitable pour le pilotage et les réunions.<br />
            Vous pouvez la rafraîchir à tout moment pour intégrer les dernières informations.
          </div>
        </div>
      </div>
      {risksDebug.length > 0 && (
        <div className="mt-8 p-4 bg-gray-50 border border-gray-200 rounded">
          <h3 className="font-bold text-indigo-700 mb-2">Debug IA - Détail de l'analyse des fichiers S3</h3>
          <div className="space-y-6">
            {risksDebug.map((dbg, idx) => (
              <div key={idx} className="p-3 border-b border-gray-200">
                <div className="font-semibold text-sm text-gray-700 mb-1">Fichier : <span className="font-mono">{dbg.key}</span> <span className="text-xs text-gray-400">({dbg.type})</span></div>
                {dbg.error && <div className="text-red-600 text-xs">Erreur : {dbg.error}</div>}
                {dbg.skipped && <div className="text-orange-600 text-xs">Fichier ignoré : {dbg.reason}</div>}
                {dbg.text && <details className="mb-1"><summary className="cursor-pointer text-xs text-gray-500">Texte extrait (début)</summary><pre className="whitespace-pre-wrap text-xs bg-gray-100 p-2 rounded max-h-40 overflow-auto">{dbg.text}</pre></details>}
                {dbg.summaryPrompt && <details className="mb-1"><summary className="cursor-pointer text-xs text-gray-500">Prompt résumé IA</summary><pre className="whitespace-pre-wrap text-xs bg-gray-100 p-2 rounded">{dbg.summaryPrompt}</pre></details>}
                {dbg.summary && <details className="mb-1"><summary className="cursor-pointer text-xs text-gray-500">Résumé IA</summary><pre className="whitespace-pre-wrap text-xs bg-gray-100 p-2 rounded">{dbg.summary}</pre></details>}
                {dbg.riskPrompt && <details className="mb-1"><summary className="cursor-pointer text-xs text-gray-500">Prompt extraction risques</summary><pre className="whitespace-pre-wrap text-xs bg-gray-100 p-2 rounded">{dbg.riskPrompt}</pre></details>}
                {dbg.riskContent && <details className="mb-1"><summary className="cursor-pointer text-xs text-gray-500">Réponse brute IA (risques)</summary><pre className="whitespace-pre-wrap text-xs bg-gray-100 p-2 rounded max-h-40 overflow-auto">{dbg.riskContent}</pre></details>}
                {Array.isArray(dbg.risks) && dbg.risks.length > 0 && <details className="mb-1"><summary className="cursor-pointer text-xs text-gray-500">Risques extraits</summary><pre className="whitespace-pre-wrap text-xs bg-gray-100 p-2 rounded">{JSON.stringify(dbg.risks, null, 2)}</pre></details>}
              </div>
            ))}
          </div>
        </div>
      )}
      {/* ChatBot accessible partout sur la page Synthèse */}
      <div className="mt-12">
        <ChatBot affaireId={numero_affaire} files={[]} loading={false} />
      </div>
    </div>
  );
} 