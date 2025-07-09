"use client"

import { useState, useRef, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Popover } from "@/components/ui/popover"

export default function ProjectSelectionPage() {
  // Champs de filtrage
  const [filters, setFilters] = useState<{
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
    affaireNonAffectee: boolean;
    portefeuilleVide: boolean;
    affaireSansDevis: boolean;
    femEsti: boolean;
    sansSitesAffectes: boolean;
    compteProjet: string;
  }>({
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
    affaireNonAffectee: false,
    portefeuilleVide: false,
    affaireSansDevis: false,
    femEsti: false,
    sansSitesAffectes: false,
    compteProjet: "",
  })

  const [etatInput, setEtatInput] = useState("");
  const [etatDropdown, setEtatDropdown] = useState(false);
  const etatRef = useRef<HTMLInputElement>(null);
  const [etatOptions, setEtatOptions] = useState<string[]>([]);
  const [etatLoading, setEtatLoading] = useState(false);
  useEffect(() => {
    setEtatLoading(true);
    fetch("/api/etats")
      .then(res => res.json())
      .then(data => {
        if (data.success) setEtatOptions(data.etats || []);
      })
      .finally(() => setEtatLoading(false));
  }, []);
  const filteredEtats = etatOptions.filter(e => e.toLowerCase().includes(etatInput.toLowerCase()));

  const [typeDemandeInput, setTypeDemandeInput] = useState("");
  const [typeDemandeDropdown, setTypeDemandeDropdown] = useState(false);
  const typeDemandeRef = useRef<HTMLInputElement>(null);
  const [typeDemandeOptions, setTypeDemandeOptions] = useState<string[]>([]);
  const [typeDemandeLoading, setTypeDemandeLoading] = useState(false);
  useEffect(() => {
    setTypeDemandeLoading(true);
    fetch("/api/types-demandes")
      .then(res => res.json())
      .then(data => {
        if (data.success) setTypeDemandeOptions(data.types || []);
      })
      .finally(() => setTypeDemandeLoading(false));
  }, []);
  const filteredTypeDemandes = typeDemandeOptions.filter(
    t => t.toLowerCase().includes(typeDemandeInput.toLowerCase()) && !(filters.typeDemande as string[]).includes(t)
  );

  const [referentInput, setReferentInput] = useState("");
  const [referentDropdown, setReferentDropdown] = useState(false);
  const referentRef = useRef<HTMLInputElement>(null);
  const [referentOptions, setReferentOptions] = useState<string[]>([]);
  const [referentLoading, setReferentLoading] = useState(false);
  useEffect(() => {
    setReferentLoading(true);
    fetch("/api/referents")
      .then(res => res.json())
      .then(data => {
        if (data.success) setReferentOptions(data.referents || []);
      })
      .finally(() => setReferentLoading(false));
  }, []);
  const filteredReferents = referentOptions.filter(r => r.toLowerCase().includes(referentInput.toLowerCase()));

  const [clientInput, setClientInput] = useState("");
  const [clientDropdown, setClientDropdown] = useState(false);
  const clientRef = useRef<HTMLInputElement>(null);
  const [clientOptions, setClientOptions] = useState<string[]>([]);
  const [clientLoading, setClientLoading] = useState(false);
  useEffect(() => {
    setClientLoading(true);
    fetch("/api/clients")
      .then(res => res.json())
      .then(data => {
        if (data.success) setClientOptions(data.clients || []);
      })
      .finally(() => setClientLoading(false));
  }, []);
  const filteredClients = clientOptions.filter(c => c.toLowerCase().includes(clientInput.toLowerCase()));

  const [contactInput, setContactInput] = useState("");
  const [contactDropdown, setContactDropdown] = useState(false);
  const contactRef = useRef<HTMLInputElement>(null);
  const [contactOptions, setContactOptions] = useState<string[]>([]);
  const [contactLoading, setContactLoading] = useState(false);
  useEffect(() => {
    setContactLoading(true);
    fetch("/api/contacts-moa")
      .then(res => res.json())
      .then(data => {
        if (data.success) setContactOptions(data.contacts || []);
      })
      .finally(() => setContactLoading(false));
  }, []);
  const filteredContacts = contactOptions.filter(c => c.toLowerCase().includes(contactInput.toLowerCase()));

  const [porteurInput, setPorteurInput] = useState("");
  const [porteurDropdown, setPorteurDropdown] = useState(false);
  const porteurRef = useRef<HTMLInputElement>(null);
  const [porteurOptions, setPorteurOptions] = useState<string[]>([]);
  const [porteurLoading, setPorteurLoading] = useState(false);
  useEffect(() => {
    setPorteurLoading(true);
    fetch("/api/porteurs")
      .then(res => res.json())
      .then(data => {
        if (data.success) setPorteurOptions(data.porteurs || []);
      })
      .finally(() => setPorteurLoading(false));
  }, []);
  const filteredPorteurs = porteurOptions.filter(p => p.toLowerCase().includes(porteurInput.toLowerCase()));

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const target = e.target as HTMLInputElement | HTMLSelectElement;
    const { name, value, type, multiple } = target;
    if (type === "checkbox") {
      setFilters({ ...filters, [name]: (target as HTMLInputElement).checked })
    } else if (multiple) {
      const options = (target as HTMLSelectElement).options;
      const selected = Array.from(options).filter((o: any) => o.selected).map((o: any) => o.value)
      setFilters({ ...filters, [name]: selected })
    } else {
      setFilters({ ...filters, [name]: value })
    }
  }

  const handleReset = () => {
    setFilters({
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
      affaireNonAffectee: false,
      portefeuilleVide: false,
      affaireSansDevis: false,
      femEsti: false,
      sansSitesAffectes: false,
      compteProjet: "",
    })
  }

  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const pageSize = 10

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setLoading(true)
    setError(null)
    setResults([])
    try {
      const res = await fetch("/api/project-selection-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(filters),
      })
      const data = await res.json()
      if (data.success) {
        setResults(data.data)
        setPage(1)
      } else {
        setError(data.error || "Erreur lors de la récupération des données.")
      }
    } catch (err: any) {
      setError(err.message || "Erreur lors de la récupération des données.")
    } finally {
      setLoading(false)
    }
  }

  // Ajout : recherche instantanée sur le numéro d'affaire
  useEffect(() => {
    // On déclenche la recherche si le champ libelle ressemble à un numéro d'affaire (ex: commence par GIST- ou longueur >= 3)
    if (filters.libelle && filters.libelle.length >= 3) {
      const timer = setTimeout(() => {
        handleSearch();
      }, 400); // debounce
      return () => clearTimeout(timer);
    }
  }, [filters.libelle]);

  const [anneePopover, setAnneePopover] = useState(false);
  const [anneeOptions, setAnneeOptions] = useState<string[]>([]);
  const [anneeLoading, setAnneeLoading] = useState(false);
  useEffect(() => {
    setAnneeLoading(true);
    fetch("/api/annees")
      .then(res => res.json())
      .then(data => {
        if (data.success) setAnneeOptions(data.annees || []);
      })
      .finally(() => setAnneeLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Bandeau horizontal */}
      <header className="w-full bg-gray-100 py-3 px-0 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 px-4 md:px-8">
          {/* Logo SNCF */}
          <div className="flex items-center gap-4 min-w-[60px]">
            <img src="/logo_sncf.jpeg" alt="Logo SNCF" className="h-14 w-auto object-contain" />
            <div className="flex flex-col justify-center">
              <span className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight">GIST</span>
              <span className="text-xs md:text-sm text-gray-600 mt-0.5">Gestion des Imputations et Suivi Travaux</span>
            </div>
          </div>
          {/* Etablissement à droite */}
          <div className="flex-shrink-0 text-xs md:text-sm text-gray-500 font-medium text-right">
            Établissement : ESTI-sncf
          </div>
        </div>
      </header>

      {/* Bandeau navigation secondaire */}
      <nav className="w-full bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 px-4 md:px-8 h-12">
          <span className="font-bold text-lg text-gray-800">GIST</span>
          <div className="flex flex-wrap md:flex-nowrap gap-2 md:gap-4 overflow-x-auto">
            {[
              "Accueil",
              "Demandes",
              "Affaires",
              "Devis",
              "Notes Travaux",
              "Interventions",
              "Rechercher",
              "Suivi des affaires",
              "Aide",
            ].map((item) => (
              <button
                key={item}
                type="button"
                className="bg-transparent border-none px-2 py-1 text-gray-700 hover:text-gist-blue hover:underline transition-colors font-medium text-sm md:text-base cursor-pointer focus:outline-none"
                style={{ outline: "none" }}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Cadre de filtrage */}
      <main className="flex-1 w-full py-10 px-0">
        <Card className="w-full max-w-6xl mx-auto p-6 md:p-10 bg-white border border-gray-200 rounded-xl shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Affaires</h2>
            <form className="grid grid-cols-1 gap-6" onSubmit={handleSearch}>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 w-full">
                {/* Libellé */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="libelle" className="text-gray-700 font-medium">Libellé</label>
                  <Input id="libelle" name="libelle" value={filters.libelle} onChange={handleChange} placeholder="N° Affaire, compte, titre de la prestation" />
                </div>
                {/* Référent autocomplete */}
                <div className="flex flex-col gap-2 relative">
                  <label htmlFor="referent" className="text-gray-700 font-medium">Référent UP ou RA (Pilote)</label>
                  <input
                    id="referent"
                    name="referent"
                    type="text"
                    autoComplete="off"
                    className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gist-blue"
                    placeholder="Tapez ou sélectionnez un référent..."
                    value={referentInput}
                    onChange={e => {
                      setReferentInput(e.target.value);
                      setFilters({ ...filters, referent: e.target.value });
                      setReferentDropdown(true);
                    }}
                    onFocus={() => setReferentDropdown(true)}
                    onBlur={() => setTimeout(() => setReferentDropdown(false), 100)}
                    ref={referentRef}
                  />
                  {referentDropdown && filteredReferents.length > 0 && (
                    <ul className="absolute left-0 w-full mt-2 z-20 bg-white bg-opacity-95 border border-gray-200 rounded-md shadow-lg max-h-40 overflow-auto">
                      {filteredReferents.map((option, idx) => (
                        <li
                          key={option}
                          className={`px-3 py-2 cursor-pointer hover:bg-gist-blue/10 ${idx === 0 ? 'bg-gist-blue/10' : ''}`}
                          onMouseDown={() => {
                            setReferentInput(option);
                            setFilters({ ...filters, referent: option });
                            setReferentDropdown(false);
                          }}
                        >
                          {option}
                        </li>
                      ))}
                    </ul>
                  )}
                  {referentDropdown && !referentLoading && filteredReferents.length === 0 && (
                    <div className="absolute left-0 w-full mt-2 z-20 bg-white border border-gray-200 rounded-md shadow-lg px-3 py-2 text-gray-400 text-sm">Aucun référent trouvé</div>
                  )}
                  {referentDropdown && referentLoading && (
                    <div className="absolute left-0 w-full mt-2 z-20 bg-white border border-gray-200 rounded-md shadow-lg px-3 py-2 text-gray-400 text-sm">Chargement...</div>
                  )}
                </div>
                {/* État autocomplete */}
                <div className="flex flex-col gap-2 relative">
                  <label htmlFor="etat" className="text-gray-700 font-medium">État</label>
                  <input
                    id="etat"
                    name="etat"
                    type="text"
                    autoComplete="off"
                    className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gist-blue"
                    placeholder="Tapez ou sélectionnez un état..."
                    value={etatInput}
                    onChange={e => {
                      setEtatInput(e.target.value);
                      setFilters({ ...filters, etat: e.target.value });
                      setEtatDropdown(true);
                    }}
                    onFocus={() => setEtatDropdown(true)}
                    onBlur={() => setTimeout(() => setEtatDropdown(false), 100)}
                    ref={etatRef}
                  />
                  {etatDropdown && filteredEtats.length > 0 && (
                    <ul className="absolute left-0 w-full mt-2 z-20 bg-white bg-opacity-95 border border-gray-200 rounded-md shadow-lg max-h-40 overflow-auto">
                      {filteredEtats.map((option, idx) => (
                        <li
                          key={option}
                          className={`px-3 py-2 cursor-pointer hover:bg-gist-blue/10 ${idx === 0 ? 'bg-gist-blue/10' : ''}`}
                          onMouseDown={() => {
                            setEtatInput(option);
                            setFilters({ ...filters, etat: option });
                            setEtatDropdown(false);
                          }}
                        >
                          {option}
                        </li>
                      ))}
                    </ul>
                  )}
                  {etatDropdown && !etatLoading && filteredEtats.length === 0 && (
                    <div className="absolute left-0 w-full mt-2 z-20 bg-white border border-gray-200 rounded-md shadow-lg px-3 py-2 text-gray-400 text-sm">Aucun état trouvé</div>
                  )}
                  {etatDropdown && etatLoading && (
                    <div className="absolute left-0 w-full mt-2 z-20 bg-white border border-gray-200 rounded-md shadow-lg px-3 py-2 text-gray-400 text-sm">Chargement...</div>
                  )}
                </div>
                {/* Guichet */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="guichet" className="text-gray-700 font-medium">Guichet</label>
                  <select id="guichet" name="guichet" value={filters.guichet} onChange={handleChange} className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gist-blue">
                    <option value="">Sélectionnez un ou des guichets</option>
                    <option value="guichet1">Guichet 1</option>
                    <option value="guichet2">Guichet 2</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 w-full">
                {/* Portefeuille projet */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="portefeuille" className="text-gray-700 font-medium">Portefeuille projet</label>
                  <select id="portefeuille" name="portefeuille" value={filters.portefeuille} onChange={handleChange} className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gist-blue">
                    <option value="">Tous</option>
                    <option value="port1">Portefeuille 1</option>
                    <option value="port2">Portefeuille 2</option>
                  </select>
                </div>
                {/* Client autocomplete */}
                <div className="flex flex-col gap-2 relative">
                  <label htmlFor="client" className="text-gray-700 font-medium">Client</label>
                  <input
                    id="client"
                    name="client"
                    type="text"
                    autoComplete="off"
                    className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gist-blue"
                    placeholder="Tapez ou sélectionnez un client..."
                    value={clientInput}
                    onChange={e => {
                      setClientInput(e.target.value);
                      setFilters({ ...filters, client: e.target.value });
                      setClientDropdown(true);
                    }}
                    onFocus={() => setClientDropdown(true)}
                    onBlur={() => setTimeout(() => setClientDropdown(false), 100)}
                    ref={clientRef}
                  />
                  {clientDropdown && filteredClients.length > 0 && (
                    <ul className="absolute left-0 w-full mt-2 z-20 bg-white bg-opacity-95 border border-gray-200 rounded-md shadow-lg max-h-40 overflow-auto">
                      {filteredClients.map((option, idx) => (
                        <li
                          key={option}
                          className={`px-3 py-2 cursor-pointer hover:bg-gist-blue/10 ${idx === 0 ? 'bg-gist-blue/10' : ''}`}
                          onMouseDown={() => {
                            setClientInput(option);
                            setFilters({ ...filters, client: option });
                            setClientDropdown(false);
                          }}
                        >
                          {option}
                        </li>
                      ))}
                    </ul>
                  )}
                  {clientDropdown && !clientLoading && filteredClients.length === 0 && (
                    <div className="absolute left-0 w-full mt-2 z-20 bg-white border border-gray-200 rounded-md shadow-lg px-3 py-2 text-gray-400 text-sm">Aucun client trouvé</div>
                  )}
                  {clientDropdown && clientLoading && (
                    <div className="absolute left-0 w-full mt-2 z-20 bg-white border border-gray-200 rounded-md shadow-lg px-3 py-2 text-gray-400 text-sm">Chargement...</div>
                  )}
                </div>
                {/* Contact MOA/MOEG */}
                <div className="flex flex-col gap-2 relative">
                  <label htmlFor="contact" className="text-gray-700 font-medium">Contact MOA/MOEG</label>
                  <input
                    id="contact"
                    name="contact"
                    type="text"
                    autoComplete="off"
                    className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gist-blue"
                    placeholder="Tapez ou sélectionnez un contact..."
                    value={contactInput}
                    onChange={e => {
                      setContactInput(e.target.value);
                      setFilters({ ...filters, contact: e.target.value });
                      setContactDropdown(true);
                    }}
                    onFocus={() => setContactDropdown(true)}
                    onBlur={() => setTimeout(() => setContactDropdown(false), 100)}
                    ref={contactRef}
                  />
                  {contactDropdown && filteredContacts.length > 0 && (
                    <ul className="absolute left-0 w-full mt-2 z-20 bg-white bg-opacity-95 border border-gray-200 rounded-md shadow-lg max-h-40 overflow-auto">
                      {filteredContacts.map((option, idx) => (
                        <li
                          key={option}
                          className={`px-3 py-2 cursor-pointer hover:bg-gist-blue/10 ${idx === 0 ? 'bg-gist-blue/10' : ''}`}
                          onMouseDown={() => {
                            setContactInput(option);
                            setFilters({ ...filters, contact: option });
                            setContactDropdown(false);
                          }}
                        >
                          {option}
                        </li>
                      ))}
                    </ul>
                  )}
                  {contactDropdown && !contactLoading && filteredContacts.length === 0 && (
                    <div className="absolute left-0 w-full mt-2 z-20 bg-white border border-gray-200 rounded-md shadow-lg px-3 py-2 text-gray-400 text-sm">Aucun contact trouvé</div>
                  )}
                  {contactDropdown && contactLoading && (
                    <div className="absolute left-0 w-full mt-2 z-20 bg-white border border-gray-200 rounded-md shadow-lg px-3 py-2 text-gray-400 text-sm">Chargement...</div>
                  )}
                </div>
                {/* Porteur de l'affaire */}
                <div className="flex flex-col gap-2 relative">
                  <label htmlFor="porteur" className="text-gray-700 font-medium">Porteur de l'affaire</label>
                  <input
                    id="porteur"
                    name="porteur"
                    type="text"
                    autoComplete="off"
                    className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gist-blue"
                    placeholder="Tapez ou sélectionnez un porteur..."
                    value={porteurInput}
                    onChange={e => {
                      setPorteurInput(e.target.value);
                      setFilters({ ...filters, porteur: e.target.value });
                      setPorteurDropdown(true);
                    }}
                    onFocus={() => setPorteurDropdown(true)}
                    onBlur={() => setTimeout(() => setPorteurDropdown(false), 100)}
                    ref={porteurRef}
                  />
                  {porteurDropdown && filteredPorteurs.length > 0 && (
                    <ul className="absolute left-0 w-full mt-2 z-20 bg-white bg-opacity-95 border border-gray-200 rounded-md shadow-lg max-h-40 overflow-auto">
                      {filteredPorteurs.map((option, idx) => (
                        <li
                          key={option}
                          className={`px-3 py-2 cursor-pointer hover:bg-gist-blue/10 ${idx === 0 ? 'bg-gist-blue/10' : ''}`}
                          onMouseDown={() => {
                            setPorteurInput(option);
                            setFilters({ ...filters, porteur: option });
                            setPorteurDropdown(false);
                          }}
                        >
                          {option}
                        </li>
                      ))}
                    </ul>
                  )}
                  {porteurDropdown && !porteurLoading && filteredPorteurs.length === 0 && (
                    <div className="absolute left-0 w-full mt-2 z-20 bg-white border border-gray-200 rounded-md shadow-lg px-3 py-2 text-gray-400 text-sm">Aucun porteur trouvé</div>
                  )}
                  {porteurDropdown && porteurLoading && (
                    <div className="absolute left-0 w-full mt-2 z-20 bg-white border border-gray-200 rounded-md shadow-lg px-3 py-2 text-gray-400 text-sm">Chargement...</div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 w-full">
                {/* Cases à cocher */}
                <div className="flex flex-col gap-2 pt-2">
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" name="affaireNonAffectee" checked={filters.affaireNonAffectee} onChange={handleChange} className="accent-gist-blue" />
                    <span>Affaire non affectée ?</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" name="portefeuilleVide" checked={filters.portefeuilleVide} onChange={handleChange} className="accent-gist-blue" />
                    <span>Portefeuille projet vide ?</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" name="affaireSansDevis" checked={filters.affaireSansDevis} onChange={handleChange} className="accent-gist-blue" />
                    <span>Affaire sans devis ?</span>
                  </label>
                </div>
                <div className="flex flex-col gap-2 pt-2">
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" name="femEsti" checked={filters.femEsti} onChange={handleChange} className="accent-gist-blue" />
                    <span>FEM-ESTI</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" name="sansSitesAffectes" checked={filters.sansSitesAffectes} onChange={handleChange} className="accent-gist-blue" />
                    <span>Sans sites affectés ?</span>
                  </label>
                  <Input id="compteProjet" name="compteProjet" placeholder="Compte projet" className="mt-2" value={filters.compteProjet} onChange={handleChange} />
                </div>
                {/* Type de demande autocomplete multiselect */}
                <div className="flex flex-col gap-2 relative">
                  <label htmlFor="typeDemande" className="text-gray-700 font-medium">Type de demande</label>
                  <div className="flex flex-wrap gap-2 mb-1">
                    {(filters.typeDemande as string[]).map((td) => (
                      <span key={td} className="bg-gist-blue/10 text-gist-blue px-2 py-1 rounded text-xs flex items-center gap-1">
                        {td}
                        <button type="button" className="ml-1 text-xs text-gist-blue hover:text-red-500" onClick={() => setFilters({ ...filters, typeDemande: (filters.typeDemande as string[]).filter((v) => v !== td) })}>&times;</button>
                      </span>
                    ))}
                  </div>
                  <input
                    id="typeDemande"
                    name="typeDemande"
                    type="text"
                    autoComplete="off"
                    className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gist-blue"
                    placeholder="Tapez ou sélectionnez un type..."
                    value={typeDemandeInput}
                    onChange={e => {
                      setTypeDemandeInput(e.target.value);
                      setTypeDemandeDropdown(true);
                    }}
                    onFocus={() => setTypeDemandeDropdown(true)}
                    onBlur={() => setTimeout(() => setTypeDemandeDropdown(false), 100)}
                    ref={typeDemandeRef}
                  />
                  {typeDemandeDropdown && filteredTypeDemandes.length > 0 && (
                    <ul className="absolute left-0 w-full mt-2 z-20 bg-white bg-opacity-95 border border-gray-200 rounded-md shadow-lg max-h-40 overflow-auto">
                      {filteredTypeDemandes.map((option, idx) => (
                        <li
                          key={option}
                          className={`px-3 py-2 cursor-pointer hover:bg-gist-blue/10 ${idx === 0 ? 'bg-gist-blue/10' : ''}`}
                          onMouseDown={() => {
                            setFilters({ ...filters, typeDemande: [...(filters.typeDemande as string[]), option] });
                            setTypeDemandeInput("");
                            setTypeDemandeDropdown(false);
                          }}
                        >
                          {option}
                        </li>
                      ))}
                    </ul>
                  )}
                  {typeDemandeDropdown && !typeDemandeLoading && filteredTypeDemandes.length === 0 && (
                    <div className="absolute left-0 w-full mt-2 z-20 bg-white border border-gray-200 rounded-md shadow-lg px-3 py-2 text-gray-400 text-sm">Aucun type trouvé</div>
                  )}
                  {typeDemandeDropdown && typeDemandeLoading && (
                    <div className="absolute left-0 w-full mt-2 z-20 bg-white border border-gray-200 rounded-md shadow-lg px-3 py-2 text-gray-400 text-sm">Chargement...</div>
                  )}
                </div>
                {/* Année, Recherche commentaire, Recherche abréviation client, Sites */}
                <div className="flex flex-col gap-2">
                  {/* Année popover */}
                  <div className="flex flex-col gap-2 relative">
                    <label htmlFor="annee" className="text-gray-700 font-medium">Année</label>
                    <button
                      type="button"
                      className="border border-gray-300 rounded-md px-3 py-2 bg-white text-left focus:outline-none focus:ring-2 focus:ring-gist-blue w-full"
                      onClick={() => setAnneePopover(v => !v)}
                    >
                      {filters.annee || "Année"}
                    </button>
                    {anneePopover && !anneeLoading && (
                      <div className="absolute left-0 w-full mt-2 z-20 bg-white border border-gray-200 rounded-md shadow-lg p-2 grid grid-cols-3 gap-2 max-h-60 overflow-auto">
                        {anneeOptions.map((year) => (
                          <button
                            key={year}
                            type="button"
                            className={`px-2 py-2 rounded text-sm font-medium hover:bg-gist-blue/10 ${filters.annee === year ? 'bg-gist-blue/20 text-gist-blue' : 'text-gray-700'}`}
                            onClick={() => {
                              setFilters({ ...filters, annee: year });
                              setAnneePopover(false);
                            }}
                          >
                            {year}
                          </button>
                        ))}
                      </div>
                    )}
                    {anneePopover && anneeLoading && (
                      <div className="absolute left-0 w-full mt-2 z-20 bg-white border border-gray-200 rounded-md shadow-lg px-3 py-2 text-gray-400 text-sm">Chargement...</div>
                    )}
                  </div>
                  <label htmlFor="rechCommentaire" className="text-gray-700 font-medium mt-2">Rech. dans commentaire</label>
                  <Input id="rechCommentaire" name="rechCommentaire" placeholder="" value={filters.rechCommentaire} onChange={handleChange} />
                  <label htmlFor="rechAbrev" className="text-gray-700 font-medium mt-2">Rech. dans abréviation client</label>
                  <Input id="rechAbrev" name="rechAbrev" placeholder="" value={filters.rechAbrev} onChange={handleChange} />
                  <label htmlFor="sites" className="text-gray-700 font-medium mt-2">Sites</label>
                  <Input id="sites" name="sites" placeholder="Rechercher un ou plusieurs site(s)" value={filters.sites} onChange={handleChange} />
                </div>
              </div>
              <div className="flex justify-center mt-8 w-full">
                <Button type="submit" className="bg-gist-blue text-white px-8 py-2 text-lg font-semibold rounded-md shadow">RECHERCHER</Button>
              </div>
            </form>
          {/* Résultats */}
          <div className="mt-10">
            {loading && <div className="text-center text-gray-500">Chargement...</div>}
            {error && <div className="text-center text-red-500">{error}</div>}
            {!loading && !error && results.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full border text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-2 py-2 border">Numéro</th>
                      <th className="px-2 py-2 border">Titre</th>
                      <th className="px-2 py-2 border">État</th>
                      <th className="px-2 py-2 border">Référent</th>
                      <th className="px-2 py-2 border">Porteur</th>
                      <th className="px-2 py-2 border">Type demande</th>
                      <th className="px-2 py-2 border">Portefeuille</th>
                      <th className="px-2 py-2 border">Priorité</th>
                      <th className="px-2 py-2 border">Date demande client</th>
                      <th className="px-2 py-2 border">Date réalisation souhaitée</th>
                      <th className="px-2 py-2 border">Compte projet</th>
                      <th className="px-2 py-2 border">Réf. client</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.slice((page-1)*pageSize, page*pageSize).map((row, idx) => (
                      <tr key={row.numero_affaire || idx} className="hover:bg-gray-50">
                        <td className="px-2 py-1 border">{row.numero_affaire}</td>
                        <td className="px-2 py-1 border">{row.titre}</td>
                        <td className="px-2 py-1 border">{row.etat}</td>
                        <td className="px-2 py-1 border">{row.referent}</td>
                        <td className="px-2 py-1 border">{row.porteur}</td>
                        <td className="px-2 py-1 border">{row.type_demande}</td>
                        <td className="px-2 py-1 border">{row.portefeuille_projet}</td>
                        <td className="px-2 py-1 border">{row.priorite}</td>
                        <td className="px-2 py-1 border">{row.date_demande_client}</td>
                        <td className="px-2 py-1 border">{row.date_rea_souhaitee}</td>
                        <td className="px-2 py-1 border">{row.compte_projet}</td>
                        <td className="px-2 py-1 border">{row.reference_client}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* Pagination */}
                <div className="flex justify-center items-center gap-4 mt-4">
                  <Button type="button" variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page-1)}>Précédent</Button>
                  <span className="text-gray-700 text-sm">Page {page} / {Math.ceil(results.length/pageSize)}</span>
                  <Button type="button" variant="outline" size="sm" disabled={page*pageSize >= results.length} onClick={() => setPage(page+1)}>Suivant</Button>
                </div>
              </div>
            )}
            {!loading && !error && results.length === 0 && (
              <div className="text-center text-gray-400 mt-8">Aucun résultat à afficher.</div>
            )}
          </div>
        </Card>
      </main>
    </div>
  )
}
