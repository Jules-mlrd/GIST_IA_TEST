"use client"

import { useState, useEffect, ChangeEvent, FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type FormState = {
  libelle: string;
  referent: string;
  etat: string;
  guichet: string;
  portefeuille: string;
  client: string;
  contact: string;
  porteur: string;
  typeDemande: string[];
  annee: string;
  rechCommentaire: string;
  rechAbrev: string;
  sites: string;
  compteProjet: string;
  description: string;
};

export default function DemandesPage() {
  const [form, setForm] = useState<FormState>({
    libelle: "",
    referent: "",
    etat: "",
    guichet: "",
    portefeuille: "",
    client: "",
    contact: "",
    porteur: "",
    typeDemande: [],
    annee: "",
    rechCommentaire: "",
    rechAbrev: "",
    sites: "",
    compteProjet: "",
    description: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Options dynamiques connectées à l'API
  const [etatOptions, setEtatOptions] = useState<string[]>([]);
  const [typeDemandeOptions, setTypeDemandeOptions] = useState<string[]>([]);
  const [referentOptions, setReferentOptions] = useState<string[]>([]);
  const [clientOptions, setClientOptions] = useState<string[]>([]);
  const [contactOptions, setContactOptions] = useState<string[]>([]);
  const [porteurOptions, setPorteurOptions] = useState<string[]>([]);
  const [guichetOptions, setGuichetOptions] = useState<string[]>([]);
  const [portefeuilleOptions, setPortefeuilleOptions] = useState<string[]>([]);
  const [anneeOptions, setAnneeOptions] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/api_database/etats").then(res => res.json()).then(data => { if (data.success) setEtatOptions(data.etats || []); });
    fetch("/api/api_database/types-demandes").then(res => res.json()).then(data => { if (data.success) setTypeDemandeOptions(data.types || []); });
    fetch("/api/api_database/referents").then(res => res.json()).then(data => { if (data.success) setReferentOptions(data.referents || []); });
    fetch("/api/api_database/clients").then(res => res.json()).then(data => { if (data.success) setClientOptions(data.clients || []); });
    fetch("/api/api_database/contacts-moa").then(res => res.json()).then(data => { if (data.success) setContactOptions(data.contacts || []); });
    fetch("/api/api_database/porteurs").then(res => res.json()).then(data => { if (data.success) setPorteurOptions(data.porteurs || []); });
    fetch("/api/api_database/guichets").then(res => res.json()).then(data => { if (data.success) setGuichetOptions(data.guichets || []); });
    fetch("/api/api_database/portefeuilles").then(res => res.json()).then(data => { if (data.success) setPortefeuilleOptions(data.portefeuilles || []); });
    fetch("/api/api_database/annees").then(res => res.json()).then(data => { if (data.success) setAnneeOptions(data.annees || []); });
  }, []);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      setForm({ ...form, [name]: (e.target as HTMLInputElement).checked });
    } else if (name === "typeDemande") {
      const arr = Array.isArray(form.typeDemande) ? [...form.typeDemande] : [];
      if (arr.includes(value)) {
        setForm({ ...form, typeDemande: arr.filter((v) => v !== value) });
      } else {
        setForm({ ...form, typeDemande: [...arr, value] });
      }
    } else {
      setForm({ ...form, [name]: value });
    }
  };

  const handleTypeDemandeInput = (e: ChangeEvent<HTMLInputElement>) => {
    setTypeDemandeInput(e.target.value);
  };

  const [typeDemandeInput, setTypeDemandeInput] = useState("");

  const handleTypeDemandeAdd = () => {
    if (typeDemandeInput && !form.typeDemande.includes(typeDemandeInput)) {
      setForm({ ...form, typeDemande: [...form.typeDemande, typeDemandeInput] });
      setTypeDemandeInput("");
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSubmitted(false);
    try {
      const res = await fetch("/api/api_database/affaires", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, annee: form.annee }),
      });
      const data = await res.json();
      if (data.success) {
        setSubmitted(true);
        setError(null);
      } else {
        setError(data.error || "Erreur lors de l'enregistrement de la demande.");
      }
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'enregistrement de la demande.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* TopNavBar supprimé car déjà inclus globalement */}
      <main className="flex-1 w-full py-10 px-0">
        <Card className="w-full max-w-6xl mx-auto p-6 md:p-10 bg-white border border-gray-200 rounded-xl shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Nouvelle demande d'affaire</h2>
          {submitted && (
            <div className="text-green-600 font-semibold text-center mb-4">Votre demande a bien été enregistrée dans la base.<br/>Elle sera prochainement prise en compte.</div>
          )}
          {error && (
            <div className="text-red-600 font-semibold text-center mb-4">{error}</div>
          )}
          <form className="grid grid-cols-1 gap-6" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 w-full">
              {/* Libellé */}
              <div className="flex flex-col gap-2">
                <label htmlFor="libelle" className="text-gray-700 font-medium">Libellé</label>
                <Input id="libelle" name="libelle" value={form.libelle} onChange={handleChange} placeholder="N° Affaire, compte, titre de la prestation" />
              </div>
              {/* Référent */}
              <div className="flex flex-col gap-2">
                <label htmlFor="referent" className="text-gray-700 font-medium">Référent</label>
                <input
                  id="referent"
                  name="referent"
                  list="referent-list"
                  value={form.referent}
                  onChange={handleChange}
                  className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gist-blue"
                  placeholder="Nom du référent"
                />
                <datalist id="referent-list">
                  {referentOptions.map((r) => <option key={r} value={r} />)}
                </datalist>
              </div>
              {/* État */}
              <div className="flex flex-col gap-2">
                <label htmlFor="etat" className="text-gray-700 font-medium">État</label>
                <input
                  id="etat"
                  name="etat"
                  list="etat-list"
                  value={form.etat}
                  onChange={handleChange}
                  className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gist-blue"
                  placeholder="État de l'affaire"
                />
                <datalist id="etat-list">
                  {etatOptions.map((e) => <option key={e} value={e} />)}
                </datalist>
              </div>
              {/* Guichet */}
              <div className="flex flex-col gap-2">
                <label htmlFor="guichet" className="text-gray-700 font-medium">Guichet</label>
                <input
                  id="guichet"
                  name="guichet"
                  list="guichet-list"
                  value={form.guichet}
                  onChange={handleChange}
                  className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gist-blue"
                  placeholder="Guichet"
                />
                <datalist id="guichet-list">
                  {guichetOptions.map((g) => <option key={g} value={g} />)}
                </datalist>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 w-full">
              {/* Portefeuille projet */}
              <div className="flex flex-col gap-2">
                <label htmlFor="portefeuille" className="text-gray-700 font-medium">Portefeuille projet</label>
                <input
                  id="portefeuille"
                  name="portefeuille"
                  list="portefeuille-list"
                  value={form.portefeuille}
                  onChange={handleChange}
                  className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gist-blue"
                  placeholder="Portefeuille projet"
                />
                <datalist id="portefeuille-list">
                  {portefeuilleOptions.map((p) => <option key={p} value={p} />)}
                </datalist>
              </div>
              {/* Client */}
              <div className="flex flex-col gap-2">
                <label htmlFor="client" className="text-gray-700 font-medium">Client</label>
                <input
                  id="client"
                  name="client"
                  list="client-list"
                  value={form.client}
                  onChange={handleChange}
                  className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gist-blue"
                  placeholder="Client"
                />
                <datalist id="client-list">
                  {clientOptions.map((c) => <option key={c} value={c} />)}
                </datalist>
              </div>
              {/* Contact MOA/MOEG */}
              <div className="flex flex-col gap-2">
                <label htmlFor="contact" className="text-gray-700 font-medium">Contact MOA/MOEG</label>
                <input
                  id="contact"
                  name="contact"
                  list="contact-list"
                  value={form.contact}
                  onChange={handleChange}
                  className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gist-blue"
                  placeholder="Contact MOA/MOEG"
                />
                <datalist id="contact-list">
                  {contactOptions.map((c) => <option key={c} value={c} />)}
                </datalist>
              </div>
              {/* Porteur de l'affaire */}
              <div className="flex flex-col gap-2">
                <label htmlFor="porteur" className="text-gray-700 font-medium">Porteur de l'affaire</label>
                <input
                  id="porteur"
                  name="porteur"
                  list="porteur-list"
                  value={form.porteur}
                  onChange={handleChange}
                  className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gist-blue"
                  placeholder="Porteur de l'affaire"
                />
                <datalist id="porteur-list">
                  {porteurOptions.map((p) => <option key={p} value={p} />)}
                </datalist>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 w-full">
              {/* Type de demande multiselect */}
              <div className="flex flex-col gap-2">
                <label htmlFor="typeDemande" className="text-gray-700 font-medium">Type de demande</label>
                <div className="flex flex-wrap gap-2 mb-1">
                  {(form.typeDemande as string[]).map((td) => (
                    <span key={td} className="bg-gist-blue/10 text-gist-blue px-2 py-1 rounded text-xs flex items-center gap-1">
                      {td}
                      <button type="button" className="ml-1 text-xs text-gist-blue hover:text-red-500" onClick={() => setForm({ ...form, typeDemande: (form.typeDemande as string[]).filter((v) => v !== td) })}>&times;</button>
                    </span>
                  ))}
                </div>
                <input
                  id="typeDemandeInput"
                  name="typeDemandeInput"
                  list="typeDemande-list"
                  value={typeDemandeInput}
                  onChange={handleTypeDemandeInput}
                  className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gist-blue"
                  placeholder="Ajouter ou écrire un type"
                  onBlur={() => {
                    if (typeDemandeInput && !form.typeDemande.includes(typeDemandeInput)) {
                      setForm({ ...form, typeDemande: [...form.typeDemande, typeDemandeInput] });
                      setTypeDemandeInput("");
                    }
                  }}
                  onKeyDown={e => {
                    if (e.key === "Enter" && typeDemandeInput && !form.typeDemande.includes(typeDemandeInput)) {
                      e.preventDefault();
                      setForm({ ...form, typeDemande: [...form.typeDemande, typeDemandeInput] });
                      setTypeDemandeInput("");
                    }
                  }}
                />
                <datalist id="typeDemande-list">
                  {typeDemandeOptions.filter(td => !(form.typeDemande as string[]).includes(td)).map((td) => (
                    <option key={td} value={td} />
                  ))}
                </datalist>
              </div>
              {/* Année */}
              <div className="flex flex-col gap-2">
                <label htmlFor="annee" className="text-gray-700 font-medium">Année</label>
                <input
                  id="annee"
                  name="annee"
                  list="annee-list"
                  value={form.annee}
                  onChange={handleChange}
                  className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gist-blue"
                  placeholder="Année"
                />
                <datalist id="annee-list">
                  {anneeOptions.map((a) => <option key={a} value={a} />)}
                </datalist>
              </div>
              {/* Compte projet */}
              <div className="flex flex-col gap-2">
                <label htmlFor="compteProjet" className="text-gray-700 font-medium">Compte projet</label>
                <Input id="compteProjet" name="compteProjet" value={form.compteProjet} onChange={handleChange} placeholder="Compte projet" />
              </div>
              {/* Sites */}
              <div className="flex flex-col gap-2">
                <label htmlFor="sites" className="text-gray-700 font-medium">Sites</label>
                <Input id="sites" name="sites" value={form.sites} onChange={handleChange} placeholder="Rechercher un ou plusieurs site(s)" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
              {/* Recherche commentaire */}
              <div className="flex flex-col gap-2">
                <label htmlFor="rechCommentaire" className="text-gray-700 font-medium">Rech. dans commentaire</label>
                <Input id="rechCommentaire" name="rechCommentaire" value={form.rechCommentaire} onChange={handleChange} />
              </div>
              {/* Recherche abréviation client */}
              <div className="flex flex-col gap-2">
                <label htmlFor="rechAbrev" className="text-gray-700 font-medium">Rech. dans abréviation client</label>
                <Input id="rechAbrev" name="rechAbrev" value={form.rechAbrev} onChange={handleChange} />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="description" className="text-gray-700 font-medium">Description</label>
              <textarea
                id="description"
                name="description"
                rows={4}
                value={form.description}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#E2001A]"
                placeholder="Décris l'objet de la demande, les enjeux, etc."
              />
            </div>
            <div className="flex justify-center mt-8 w-full">
              <Button type="submit" className="bg-gist-blue text-white px-8 py-2 text-lg font-semibold rounded-md shadow" disabled={loading}>{loading ? "Enregistrement..." : "ENREGISTRER LA DEMANDE"}</Button>
            </div>
          </form>
        </Card>
      </main>
    </div>
  );
} 