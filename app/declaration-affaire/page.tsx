"use client";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Layout } from "@/components/layout";

// Types
interface S3Document {
  name: string;
  key: string;
  size: string;
  lastModified: string;
  type: string;
  url: string;
}

const defaultFields = {
  projectName: "",
  projectId: "",
  startDate: "",
  endDate: "",
  summary: "",
  objectives: [""],
  projectManager: { name: "", contact: "" },
  teamMembers: [{ name: "", role: "", contact: "" }],
  partners: [""],
  budget: {
    total: "",
    used: "",
    remaining: "",
    mainExpenses: [{ label: "", amount: "" }],
    alerts: [""]
  },
  milestones: [{ date: "", label: "" }],
  progress: "",
  scheduleAlerts: [""],
  risks: [{ description: "", level: "", owner: "" }],
  deliverables: [{ label: "", status: "" }],
  contacts: [{ name: "", role: "", contact: "" }],
  legal: "",
  comments: ""
};

function mapAIToFields(ai: any) {
  return {
    projectName: ai.projectName || "",
    projectId: ai.projectId || "",
    startDate: ai.startDate || "",
    endDate: ai.endDate || "",
    summary: ai.summary || "",
    objectives: Array.isArray(ai.objectives) ? ai.objectives : (ai.objectives ? [ai.objectives] : [""]),
    projectManager: ai.projectManager || { name: "", contact: "" },
    teamMembers: Array.isArray(ai.teamMembers) && ai.teamMembers.length > 0 ? ai.teamMembers : [{ name: "", role: "", contact: "" }],
    partners: Array.isArray(ai.partners) ? ai.partners : (ai.partners ? [ai.partners] : [""]),
    budget: {
      total: ai.budget?.total || "",
      used: ai.budget?.used || "",
      remaining: ai.budget?.remaining || "",
      mainExpenses: Array.isArray(ai.budget?.mainExpenses) && ai.budget.mainExpenses.length > 0 ? ai.budget.mainExpenses : [{ label: "", amount: "" }],
      alerts: Array.isArray(ai.budget?.alerts) ? ai.budget.alerts : (ai.budget?.alerts ? [ai.budget.alerts] : [""])
    },
    milestones: Array.isArray(ai.milestones) && ai.milestones.length > 0 ? ai.milestones : [{ date: "", label: "" }],
    progress: ai.progress || "",
    scheduleAlerts: Array.isArray(ai.scheduleAlerts) ? ai.scheduleAlerts : (ai.scheduleAlerts ? [ai.scheduleAlerts] : [""]),
    risks: Array.isArray(ai.risks) && ai.risks.length > 0 ? ai.risks : [{ description: "", level: "", owner: "" }],
    deliverables: Array.isArray(ai.deliverables) && ai.deliverables.length > 0 ? ai.deliverables : [{ label: "", status: "" }],
    contacts: Array.isArray(ai.contacts) && ai.contacts.length > 0 ? ai.contacts : [{ name: "", role: "", contact: "" }],
    legal: ai.legal || "",
    comments: ai.comments || ""
  };
}

// Fonction utilitaire pour corriger l'encodage des caractères accentués
function fixEncoding(str: string) {
  return str
    .replace(/Ã©/g, 'é')
    .replace(/Ã¨/g, 'è')
    .replace(/Ã /g, 'à')
    .replace(/Ã´/g, 'ô')
    .replace(/Ãª/g, 'ê')
    .replace(/Ã»/g, 'û')
    .replace(/Ã®/g, 'î')
    .replace(/Ã§/g, 'ç')
    .replace(/Ã€/g, 'À')
    .replace(/Ã‰/g, 'É')
    .replace(/Ã‹/g, 'Ë')
    .replace(/Ã‹/g, 'Ë')
    .replace(/Ãœ/g, 'Ü')
    .replace(/Ã–/g, 'Ö')
    .replace(/Ã„/g, 'Ä')
    .replace(/Ã…/g, 'Å')
    .replace(/Ã–/g, 'Ö')
    .replace(/Ãœ/g, 'Ü')
    .replace(/ÃŸ/g, 'ß')
    .replace(/Ã±/g, 'ñ')
    .replace(/Ã¼/g, 'ü')
    .replace(/Ã¶/g, 'ö')
    .replace(/Ã¤/g, 'ä')
    .replace(/Ã¥/g, 'å')
    .replace(/Ã³/g, 'ó')
    .replace(/Ã¡/g, 'á')
    .replace(/Ã­/g, 'í')
    .replace(/Ã³/g, 'ó')
    .replace(/Ãº/g, 'ú')
    .replace(/Ã±/g, 'ñ')
    .replace(/Ã¼/g, 'ü')
    .replace(/Ã¿/g, 'ÿ')
    .replace(/Ã€/g, 'À')
    .replace(/Ã¨/g, 'è')
    .replace(/Ã¹/g, 'ù')
    .replace(/Ãª/g, 'ê')
    .replace(/Ã¢/g, 'â')
    .replace(/Ã´/g, 'ô')
    .replace(/Ã®/g, 'î')
    .replace(/Ã¯/g, 'ï')
    .replace(/Ã¼/g, 'ü')
    .replace(/Ã§/g, 'ç');
}

const DECLARATION_CACHE_KEY = 'declaration_affaire_cache_v1';
const DECLARATION_CACHE_EXPIRATION_MS = 10 * 60 * 1000; // 10 minutes

export default function DeclarationAffairePage() {
  // S3
  const [s3Files, setS3Files] = useState<S3Document[]>([]);
  const [selectedS3Keys, setSelectedS3Keys] = useState<string[]>([]);
  const [loadingS3, setLoadingS3] = useState(false);
  const [s3Error, setS3Error] = useState("");

  // Upload
  const [files, setFiles] = useState<File[]>([]);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Analyse IA
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");

  // Formulaire projet
  const [fields, setFields] = useState(defaultFields);

  // Ajout d'un état pour le feedback de résumé IA
  const [summarizationNotice, setSummarizationNotice] = useState("");

  // Ajout d'un état pour le feedback de fusion IA
  const [fusionNotice, setFusionNotice] = useState("");

  // Ajout d'un état pour le reset
  const [resetting, setResetting] = useState(false);

  // Chargement fichiers S3
  useEffect(() => {
    setLoadingS3(true);
    setS3Error("");
    fetch("/api/documents")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data.documents)) setS3Files(data.documents);
        else setS3Files([]);
      })
      .catch(() => setS3Error("Erreur lors du chargement des fichiers S3."))
      .finally(() => setLoadingS3(false));
  }, []);

  // Sélection S3
  const handleS3FileToggle = (key: string) => {
    setSelectedS3Keys(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  // Upload manuel
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles(Array.from(e.target.files));
  };

  // Fonction pour charger depuis le cache ou l'API
  const fetchDeclaration = async (keys: string[], currentFields: any) => {
    // Vérifier le cache localStorage
    const cacheKey = DECLARATION_CACHE_KEY + '_' + (keys.sort().join(','));
    const cached = typeof window !== 'undefined' ? localStorage.getItem(cacheKey) : null;
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < DECLARATION_CACHE_EXPIRATION_MS) {
        setFields((prev) => ({ ...prev, ...mapAIToFields(data) }));
        return true;
      }
    }
    // Sinon, appel API
    const res = await fetch("/api/declaration-affaire", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keys, currentFields }),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      setAnalyzeError(data.error || "Erreur lors de l'analyse IA");
      return false;
    } else {
      setFields((prev) => ({ ...prev, ...mapAIToFields(data) }));
      if (typeof window !== 'undefined') {
        localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
      }
      return true;
    }
  };

  // Remplacer handleAnalyze pour utiliser le cache
  const handleAnalyze = async () => {
    setAnalyzing(true);
    setAnalyzeError("");
    setSummarizationNotice("");
    setFusionNotice("");
    try {
      let keys: string[] = [];
      if (selectedS3Keys.length > 0) {
        keys = selectedS3Keys;
      } else if (files.length > 0) {
        setAnalyzeError("L'analyse directe de fichiers uploadés n'est pas encore supportée. Merci de sélectionner des fichiers S3.");
        setAnalyzing(false);
        return;
      } else {
        setAnalyzeError("Veuillez sélectionner au moins un fichier S3.");
        setAnalyzing(false);
        return;
      }
      await fetchDeclaration(keys, fields);
    } catch (e: any) {
      setAnalyzeError(e?.message || "Erreur inattendue");
    } finally {
      setAnalyzing(false);
    }
  };

  // Bouton pour reset le cache
  const handleResetCache = () => {
    setResetting(true);
    try {
      if (typeof window !== 'undefined') {
        // Supprimer toutes les entrées de cache déclaration d'affaire
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith(DECLARATION_CACHE_KEY)) {
            localStorage.removeItem(key);
          }
        });
      }
      // Réinitialiser le formulaire
      setFields(defaultFields);
    } finally {
      setResetting(false);
    }
  };

  // Export PDF (réel)
  const handleExportPDF = async () => {
    try {
      const res = await fetch("/api/declaration-affaire", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (!res.ok) throw new Error("Erreur lors de la génération du PDF");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "declaration-affaire.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e?.message || "Erreur lors de l'export PDF");
    }
  };

  return (
    <Layout title="Déclaration d'affaire">
      <div className="max-w-4xl mx-auto py-8 space-y-8">
        <h1 className="text-3xl font-bold mb-2">Déclaration d'affaire</h1>
        <p className="text-gray-600 mb-6">Remplissez ou laissez l'IA compléter automatiquement la fiche projet à partir de vos documents.</p>

        {/* Feedback fusion IA si applicable */}
        {fusionNotice && (
          <div className="mb-4 p-3 bg-green-50 border border-green-300 rounded text-green-900">
            {fixEncoding(fusionNotice)}
          </div>
        )}

        {/* Feedback fichiers sélectionnés */}
        {selectedS3Keys.length > 0 && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
            <div className="font-semibold text-blue-700 mb-1">Fichiers sélectionnés :</div>
            <ul className="list-disc list-inside text-blue-900 text-sm">
              {s3Files.filter(f => selectedS3Keys.includes(f.key)).map(f => (
                <li key={f.key}>{f.name} <span className="text-gray-400">({f.type}, {f.size})</span></li>
              ))}
            </ul>
          </div>
        )}

        {/* Notice de résumé IA si applicable */}
        {summarizationNotice && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-300 rounded text-yellow-900">
            {summarizationNotice}
          </div>
        )}

        {/* Section 1 : Fichiers S3 */}
        <section className="bg-white border rounded-lg p-4 shadow-sm">
          <h2 className="font-semibold mb-2">1. Sélectionner des fichiers du projet (S3)</h2>
          {loadingS3 ? <div className="text-gray-500">Chargement...</div> : null}
          {s3Error && <div className="text-red-500">{s3Error}</div>}
          <div className="max-h-48 overflow-y-auto border rounded p-2 bg-gray-50">
            {s3Files.length === 0 && !loadingS3 && <div className="text-gray-400 text-sm">Aucun fichier trouvé sur le bucket.</div>}
            {s3Files.map((file) => (
              <label key={file.key} className="flex items-center gap-2 text-sm py-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedS3Keys.includes(file.key)}
                  onChange={() => handleS3FileToggle(file.key)}
                />
                <span>{file.name} <span className="text-gray-400">({file.type}, {file.size})</span></span>
              </label>
            ))}
          </div>
        </section>

        {/* Section 2 : Upload manuel */}
        <section className="bg-white border rounded-lg p-4 shadow-sm">
          <h2 className="font-semibold mb-2">2. Importer des fichiers manuellement</h2>
          <Input type="file" multiple onChange={handleFileChange} ref={fileInputRef} />
          {files.length > 0 && (
            <ul className="mt-2 text-sm text-gray-700">
              {files.map((file, idx) => <li key={idx}>{file.name}</li>)}
            </ul>
          )}
          {uploadError && <div className="text-red-500">{uploadError}</div>}
        </section>

        {/* Section 3 : Analyse IA */}
        <section className="bg-white border rounded-lg p-4 shadow-sm flex flex-col gap-2">
          <div className="flex gap-2 mb-4">
            <Button onClick={handleAnalyze} disabled={analyzing || (selectedS3Keys.length === 0 && files.length === 0)}>
              {analyzing ? "Analyse en cours..." : "Analyser avec l'IA"}
            </Button>
            <Button onClick={handleResetCache} variant="outline" disabled={resetting}>
              {resetting ? "Reset..." : "Reset cache"}
            </Button>
          </div>
          {analyzeError && <div className="text-red-500">{analyzeError}</div>}
        </section>

        {/* Section 4 : Formulaire projet */}
        <section className="bg-white border rounded-lg p-4 shadow-sm">
          <h2 className="font-semibold mb-4">4. Fiche projet</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input placeholder="Nom du projet" value={fields.projectName} onChange={e => setFields(f => ({ ...f, projectName: e.target.value }))} />
            <Input placeholder="ID projet" value={fields.projectId} onChange={e => setFields(f => ({ ...f, projectId: e.target.value }))} />
            <Input placeholder="Date de début" value={fields.startDate} onChange={e => setFields(f => ({ ...f, startDate: e.target.value }))} />
            <Input placeholder="Date de fin prévue" value={fields.endDate} onChange={e => setFields(f => ({ ...f, endDate: e.target.value }))} />
          </div>
          <Textarea className="mt-4" placeholder="Résumé du projet" value={fields.summary} onChange={e => setFields(f => ({ ...f, summary: e.target.value }))} />

          {/* Chef de projet */}
          <div className="mt-4">
            <label className="font-medium">Chef de projet</label>
            <div className="flex gap-2 mt-1">
              <Input placeholder="Nom" value={fields.projectManager?.name || ""} onChange={e => setFields(f => ({ ...f, projectManager: { ...f.projectManager, name: e.target.value } }))} />
              <Input placeholder="Contact" value={fields.projectManager?.contact || ""} onChange={e => setFields(f => ({ ...f, projectManager: { ...f.projectManager, contact: e.target.value } }))} />
            </div>
          </div>

          {/* Membres clés dynamiques */}
          <div className="mt-4">
            <label className="font-medium">Membres clés</label>
            {fields.teamMembers.map((m, idx) => (
              <div key={idx} className="flex gap-2 mt-1">
                <Input placeholder="Nom" value={m.name} onChange={e => setFields(f => { const arr = [...f.teamMembers]; arr[idx].name = e.target.value; return { ...f, teamMembers: arr }; })} />
                <Input placeholder="Rôle" value={m.role} onChange={e => setFields(f => { const arr = [...f.teamMembers]; arr[idx].role = e.target.value; return { ...f, teamMembers: arr }; })} />
                <Input placeholder="Contact" value={m.contact} onChange={e => setFields(f => { const arr = [...f.teamMembers]; arr[idx].contact = e.target.value; return { ...f, teamMembers: arr }; })} />
                <Button type="button" variant="outline" onClick={() => setFields(f => ({ ...f, teamMembers: f.teamMembers.filter((_, i) => i !== idx) }))}>-</Button>
              </div>
            ))}
            <Button type="button" size="sm" className="mt-2" onClick={() => setFields(f => ({ ...f, teamMembers: [...f.teamMembers, { name: "", role: "", contact: "" }] }))}>Ajouter un membre</Button>
          </div>

          {/* Partenaires dynamiques */}
          <div className="mt-4">
            <label className="font-medium">Partenaires</label>
            {fields.partners.map((p, idx) => (
              <div key={idx} className="flex gap-2 mt-1">
                <Input value={p} onChange={e => setFields(f => { const arr = [...f.partners]; arr[idx] = e.target.value; return { ...f, partners: arr }; })} />
                <Button type="button" variant="outline" onClick={() => setFields(f => ({ ...f, partners: f.partners.filter((_, i) => i !== idx) }))}>-</Button>
              </div>
            ))}
            <Button type="button" size="sm" className="mt-2" onClick={() => setFields(f => ({ ...f, partners: [...f.partners, ""] }))}>Ajouter un partenaire</Button>
          </div>

          {/* Budget */}
          <div className="mt-4">
            <label className="font-medium">Budget</label>
            <div className="flex gap-2 mt-1">
              <Input placeholder="Total" value={fields.budget.total} onChange={e => setFields(f => ({ ...f, budget: { ...f.budget, total: e.target.value } }))} />
              <Input placeholder="Utilisé" value={fields.budget.used} onChange={e => setFields(f => ({ ...f, budget: { ...f.budget, used: e.target.value } }))} />
              <Input placeholder="Restant" value={fields.budget.remaining} onChange={e => setFields(f => ({ ...f, budget: { ...f.budget, remaining: e.target.value } }))} />
            </div>
            {/* Postes de dépense dynamiques */}
            <div className="mt-2">
              <label className="text-sm">Postes de dépense</label>
              {fields.budget.mainExpenses.map((exp, idx) => (
                <div key={idx} className="flex gap-2 mt-1">
                  <Input placeholder="Label" value={exp.label} onChange={e => setFields(f => { const arr = [...f.budget.mainExpenses]; arr[idx].label = e.target.value; return { ...f, budget: { ...f.budget, mainExpenses: arr } }; })} />
                  <Input placeholder="Montant" value={exp.amount} onChange={e => setFields(f => { const arr = [...f.budget.mainExpenses]; arr[idx].amount = e.target.value; return { ...f, budget: { ...f.budget, mainExpenses: arr } }; })} />
                  <Button type="button" variant="outline" onClick={() => setFields(f => ({ ...f, budget: { ...f.budget, mainExpenses: f.budget.mainExpenses.filter((_, i) => i !== idx) } }))}>-</Button>
                </div>
              ))}
              <Button type="button" size="sm" className="mt-2" onClick={() => setFields(f => ({ ...f, budget: { ...f.budget, mainExpenses: [...f.budget.mainExpenses, { label: "", amount: "" }] } }))}>Ajouter un poste</Button>
            </div>
            {/* Alertes budget dynamiques */}
            <div className="mt-2">
              <label className="text-sm">Alertes budget</label>
              {fields.budget.alerts.map((a, idx) => (
                <div key={idx} className="flex gap-2 mt-1">
                  <Input value={a} onChange={e => setFields(f => { const arr = [...f.budget.alerts]; arr[idx] = e.target.value; return { ...f, budget: { ...f.budget, alerts: arr } }; })} />
                  <Button type="button" variant="outline" onClick={() => setFields(f => ({ ...f, budget: { ...f.budget, alerts: f.budget.alerts.filter((_, i) => i !== idx) } }))}>-</Button>
                </div>
              ))}
              <Button type="button" size="sm" className="mt-2" onClick={() => setFields(f => ({ ...f, budget: { ...f.budget, alerts: [...f.budget.alerts, ""] } }))}>Ajouter une alerte</Button>
            </div>
          </div>

          {/* Jalons dynamiques */}
          <div className="mt-4">
            <label className="font-medium">Jalons</label>
            {fields.milestones.map((m, idx) => (
              <div key={idx} className="flex gap-2 mt-1">
                <Input placeholder="Date" value={m.date} onChange={e => setFields(f => { const arr = [...f.milestones]; arr[idx].date = e.target.value; return { ...f, milestones: arr }; })} />
                <Input placeholder="Intitulé" value={m.label} onChange={e => setFields(f => { const arr = [...f.milestones]; arr[idx].label = e.target.value; return { ...f, milestones: arr }; })} />
                <Button type="button" variant="outline" onClick={() => setFields(f => ({ ...f, milestones: f.milestones.filter((_, i) => i !== idx) }))}>-</Button>
              </div>
            ))}
            <Button type="button" size="sm" className="mt-2" onClick={() => setFields(f => ({ ...f, milestones: [...f.milestones, { date: "", label: "" }] }))}>Ajouter un jalon</Button>
          </div>

          {/* Livrables dynamiques */}
          <div className="mt-4">
            <label className="font-medium">Livrables</label>
            {fields.deliverables.map((d, idx) => (
              <div key={idx} className="flex gap-2 mt-1">
                <Input placeholder="Label" value={d.label} onChange={e => setFields(f => { const arr = [...f.deliverables]; arr[idx].label = e.target.value; return { ...f, deliverables: arr }; })} />
                <Input placeholder="Statut" value={d.status} onChange={e => setFields(f => { const arr = [...f.deliverables]; arr[idx].status = e.target.value; return { ...f, deliverables: arr }; })} />
                <Button type="button" variant="outline" onClick={() => setFields(f => ({ ...f, deliverables: f.deliverables.filter((_, i) => i !== idx) }))}>-</Button>
              </div>
            ))}
            <Button type="button" size="sm" className="mt-2" onClick={() => setFields(f => ({ ...f, deliverables: [...f.deliverables, { label: "", status: "" }] }))}>Ajouter un livrable</Button>
          </div>

          {/* Risques dynamiques */}
          <div className="mt-4">
            <label className="font-medium">Risques</label>
            {fields.risks.map((r, idx) => (
              <div key={idx} className="flex gap-2 mt-1">
                <Input placeholder="Description" value={r.description} onChange={e => setFields(f => { const arr = [...f.risks]; arr[idx].description = e.target.value; return { ...f, risks: arr }; })} />
                <Input placeholder="Criticité" value={r.level} onChange={e => setFields(f => { const arr = [...f.risks]; arr[idx].level = e.target.value; return { ...f, risks: arr }; })} />
                <Input placeholder="Responsable" value={r.owner} onChange={e => setFields(f => { const arr = [...f.risks]; arr[idx].owner = e.target.value; return { ...f, risks: arr }; })} />
                <Button type="button" variant="outline" onClick={() => setFields(f => ({ ...f, risks: f.risks.filter((_, i) => i !== idx) }))}>-</Button>
              </div>
            ))}
            <Button type="button" size="sm" className="mt-2" onClick={() => setFields(f => ({ ...f, risks: [...f.risks, { description: "", level: "", owner: "" }] }))}>Ajouter un risque</Button>
          </div>

          {/* Contacts dynamiques */}
          <div className="mt-4">
            <label className="font-medium">Contacts importants</label>
            {fields.contacts.map((c, idx) => (
              <div key={idx} className="flex gap-2 mt-1">
                <Input placeholder="Nom" value={c.name} onChange={e => setFields(f => { const arr = [...f.contacts]; arr[idx].name = e.target.value; return { ...f, contacts: arr }; })} />
                <Input placeholder="Rôle" value={c.role} onChange={e => setFields(f => { const arr = [...f.contacts]; arr[idx].role = e.target.value; return { ...f, contacts: arr }; })} />
                <Input placeholder="Contact" value={c.contact} onChange={e => setFields(f => { const arr = [...f.contacts]; arr[idx].contact = e.target.value; return { ...f, contacts: arr }; })} />
                <Button type="button" variant="outline" onClick={() => setFields(f => ({ ...f, contacts: f.contacts.filter((_, i) => i !== idx) }))}>-</Button>
              </div>
            ))}
            <Button type="button" size="sm" className="mt-2" onClick={() => setFields(f => ({ ...f, contacts: [...f.contacts, { name: "", role: "", contact: "" }] }))}>Ajouter un contact</Button>
          </div>

          {/* Mentions légales */}
          <Textarea className="mt-4" placeholder="Mentions légales ou contractuelles" value={fields.legal} onChange={e => setFields(f => ({ ...f, legal: e.target.value }))} />

          {/* Progression et alertes planning */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input placeholder="Avancement (%)" value={fields.progress} onChange={e => setFields(f => ({ ...f, progress: e.target.value }))} />
            <div>
              <label className="font-medium">Alertes planning</label>
              {fields.scheduleAlerts.map((a, idx) => (
                <div key={idx} className="flex gap-2 mt-1">
                  <Input value={a} onChange={e => setFields(f => { const arr = [...f.scheduleAlerts]; arr[idx] = e.target.value; return { ...f, scheduleAlerts: arr }; })} />
                  <Button type="button" variant="outline" onClick={() => setFields(f => ({ ...f, scheduleAlerts: f.scheduleAlerts.filter((_, i) => i !== idx) }))}>-</Button>
                </div>
              ))}
              <Button type="button" size="sm" className="mt-2" onClick={() => setFields(f => ({ ...f, scheduleAlerts: [...f.scheduleAlerts, ""] }))}>Ajouter une alerte</Button>
            </div>
          </div>

          <Textarea className="mt-4" placeholder="Commentaires libres" value={fields.comments} onChange={e => setFields(f => ({ ...f, comments: e.target.value }))} />
        </section>

        {/* Section 5 : Export PDF */}
        <section className="bg-white border rounded-lg p-4 shadow-sm flex flex-col gap-2">
          <Button onClick={handleExportPDF} variant="outline">Exporter en PDF</Button>
        </section>
      </div>
    </Layout>
  );
} 