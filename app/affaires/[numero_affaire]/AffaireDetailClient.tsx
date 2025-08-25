'use client';
import { useAffaireChatbot } from '@/hooks/useAffaireChatbot';
import { ChatBot } from '@/components/chatbot';
import AffaireFilesClient from './AffaireFilesClient';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import Link from "next/link";
import AffaireNav from '@/components/AffaireNav';

const FIELD_LABELS: { [key: string]: string } = {
  portefeuille_projet: 'Portefeuille projet',
  communication_client: 'Communication client',
  type_demande: 'Type de demande',
  referent: 'Référent client',
  guichet: 'Guichet de Traitement',
  porteur: "Porteur de l'affaire",
  type_mission: 'Type de mission',
  risque_environnemental: 'Risque environnemental',
  commentaires_env: 'Commentaires environnementaux',
  contact_moa_moeg: 'Demandeur/MOEG',
  client: 'MOA',
  site: 'Sites',
  description_technique: 'Description technique du projet',
  code_c6: 'Code C6',
  fem_esti: 'FEM-ESTI',
  etat: 'Etat',
  sa: 'SA',
  compte_projet: 'Type de comptes',
  type_decret: 'Type décret',
  contact_site: 'Contact sur site',
  mesure_env: 'Mesure environnementale',
};

const FIELD_ORDER = [
  'portefeuille_projet',
  'communication_client',
  'type_demande',
  'referent',
  'guichet',
  'porteur',
  'type_mission',
  'risque_environnemental',
  'commentaires_env',
  'contact_moa_moeg',
  'client',
  'site',
  'description_technique',
  'code_c6',
  'fem_esti',
  'etat',
  'sa',
  'compte_projet',
  'type_decret',
  'contact_site',
  'mesure_env',
];

export default function AffaireDetailClient({ affaire }: { affaire: any }) {
  const { files, loading } = useAffaireChatbot(affaire.numero_affaire);
  const [showFiles, setShowFiles] = useState(false);
  const [demandes, setDemandes] = useState<any[]>([]);
  const [loadingDemandes, setLoadingDemandes] = useState(true);
  const [errorDemandes, setErrorDemandes] = useState<string | null>(null);
  const [devis, setDevis] = useState<any | null>(null);
  const [loadingDevis, setLoadingDevis] = useState(true);
  const [errorDevis, setErrorDevis] = useState<string | null>(null);
  const [notesTravaux, setNotesTravaux] = useState<any[]>([]);
  const [loadingNotesTravaux, setLoadingNotesTravaux] = useState(true);
  const [errorNotesTravaux, setErrorNotesTravaux] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDemandes() {
      setLoadingDemandes(true);
      setErrorDemandes(null);
      try {
        const res = await fetch(`/api/api_database/affaires/${affaire.numero_affaire}/demandes`);
        const data = await res.json();
        if (data.success) setDemandes(data.demandes || []);
        else setErrorDemandes(data.error || 'Erreur lors du chargement des demandes');
      } catch (e: any) {
        setErrorDemandes(e?.message || 'Erreur lors du chargement des demandes');
      } finally {
        setLoadingDemandes(false);
      }
    }
    if (affaire.numero_affaire) fetchDemandes();
  }, [affaire.numero_affaire]);

  useEffect(() => {
    async function fetchDevis() {
      setLoadingDevis(true);
      setErrorDevis(null);
      try {
        const res = await fetch(`/api/api_database/affaires/${affaire.numero_affaire}/devis`);
        const data = await res.json();
        if (data.success) setDevis(data.devis);
        else setErrorDevis(data.error || 'Erreur lors du chargement du devis');
      } catch (e: any) {
        setErrorDevis(e?.message || 'Erreur lors du chargement du devis');
      } finally {
        setLoadingDevis(false);
      }
    }
    if (affaire.numero_affaire) fetchDevis();
  }, [affaire.numero_affaire]);

  useEffect(() => {
    async function fetchNotesTravaux() {
      setLoadingNotesTravaux(true);
      setErrorNotesTravaux(null);
      try {
        const res = await fetch(`/api/api_database/affaires/${affaire.numero_affaire}/notes-travaux`);
        const data = await res.json();
        if (data.success) setNotesTravaux(data.notes || []);
        else setErrorNotesTravaux(data.error || 'Erreur lors du chargement des notes travaux');
      } catch (e: any) {
        setErrorNotesTravaux(e?.message || 'Erreur lors du chargement des notes travaux');
      } finally {
        setLoadingNotesTravaux(false);
      }
    }
    if (affaire.numero_affaire) fetchNotesTravaux();
  }, [affaire.numero_affaire]);

  return (
    <div className="w-[90vw] max-w-none mx-auto py-8 px-2 md:px-8 animate-fade-in text-base">
      <AffaireNav numero_affaire={affaire.numero_affaire} active="detail" />
      <div className="w-full bg-black px-6 py-4 mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-white text-center whitespace-nowrap overflow-x-auto">
          {affaire.titre || 'Affaire'} ({affaire.numero_affaire})
        </h1>
      </div>
      <div className="flex flex-col md:flex-row w-full max-w-full mx-auto gap-4">
        <div className="w-full md:w-1/2">
          <div className="bg-green-600 rounded-t-lg px-6 py-5">
            <h2 className="text-lg font-bold text-white">Informations générales</h2>
          </div>
          <div className="bg-white border rounded-b-lg shadow p-8 mb-8 text-base">
            <table className="w-full text-left border-collapse">
              <tbody>
                {FIELD_ORDER.map((key) => (
                  <tr key={key} className="border-b last:border-b-0">
                    <th className="py-3 pr-4 font-semibold text-gray-700 w-1/3">{FIELD_LABELS[key]}</th>
                    <td className="py-3 text-gray-900">
                      {key === 's3_folder' && typeof affaire[key] === 'string' ? (
                        <a href={affaire[key]} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Accéder aux documents</a>
                      ) : (affaire[key] !== null && affaire[key] !== undefined && affaire[key] !== '' ? String(affaire[key]) : <span className="text-gray-400">Non renseigné</span>)}
                    </td>
                  </tr>
                ))}
                {affaire.s3_folder && (
                  <tr>
                    <th className="py-3 pr-4 font-semibold text-gray-700 w-1/3">Documents S3</th>
                    <td className="py-3 text-gray-900">
                      <a href={affaire.s3_folder} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Accéder aux documents</a>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="w-full md:w-1/2">
          <div className="bg-violet-600 rounded-t-lg px-6 py-5 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Fichiers</h2>
            {showFiles && (
              <button
                className="ml-2 p-1 rounded hover:bg-violet-700 text-white"
                aria-label="Fermer les fichiers"
                onClick={() => setShowFiles(false)}
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
          {/* Bloc Fichiers sans bouton Note Travaux */}
          <div className="bg-white border rounded-b-lg shadow p-8 mb-8 text-base flex flex-col gap-4">
            {/* Lien vers le dossier S3 de l'affaire */}
            {affaire.s3_folder && (
              <a href={affaire.s3_folder} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-all mb-2">
                Accéder au dossier S3 de l'affaire
              </a>
            )}
            {/* Bouton afficher/masquer la liste des fichiers */}
            <button
              onClick={() => setShowFiles(v => !v)}
              className="self-start px-3 py-1 text-sm rounded bg-violet-600 text-white hover:bg-violet-700 mb-2"
            >
              {showFiles ? 'Masquer la liste des fichiers' : 'Afficher la liste des fichiers'}
            </button>
            {/* Liste des fichiers, masquée par défaut */}
            {showFiles && <AffaireFilesClient numero_affaire={affaire.numero_affaire} />}
          </div>
          <ChatBot affaireId={affaire.numero_affaire} files={files} loading={loading} />
        </div>
      </div>
      <div className="w-full max-w-full mx-auto mt-4">
        <div className="bg-orange-500 rounded-t-lg px-6 py-5">
          <h2 className="text-lg font-bold text-white">Demande client</h2>
        </div>
        <div className="bg-white border rounded-b-lg shadow p-8 mb-8 text-base">
          {loadingDemandes ? (
            <div>Chargement des demandes...</div>
          ) : errorDemandes ? (
            <div className="text-red-600">{errorDemandes}</div>
          ) : demandes.length === 0 ? (
            <div className="text-gray-500">Aucune demande trouvée pour cette affaire.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border text-sm">
                <thead>
                  <tr className="bg-orange-100">
                    <th className="px-3 py-2 border">Numéro</th>
                    <th className="px-3 py-2 border">Demandeur</th>
                    <th className="px-3 py-2 border">État</th>
                    <th className="px-3 py-2 border">Compte projet</th>
                    <th className="px-3 py-2 border">Titre</th>
                    <th className="px-3 py-2 border">Date de demande</th>
                    <th className="px-3 py-2 border">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {demandes.map((d) => (
                    <tr key={d.id} className="border-b last:border-b-0">
                      <td className="px-3 py-2 border">{d.numero_demande || '-'}</td>
                      <td className="px-3 py-2 border">{d.demandeur || '-'}</td>
                      <td className="px-3 py-2 border">{d.etat || '-'}</td>
                      <td className="px-3 py-2 border">{d.compte_projet || '-'}</td>
                      <td className="px-3 py-2 border">{d.titre || '-'}</td>
                      <td className="px-3 py-2 border">{d.date_demande ? new Date(d.date_demande).toLocaleDateString() : '-'}</td>
                      <td className="px-3 py-2 border">{d.statut || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      <div className="w-full max-w-full mx-auto mt-4">
        <div className="bg-gray-800 rounded-t-lg px-6 py-5">
          <h2 className="text-lg font-bold text-white">Devis</h2>
        </div>
        <div className="bg-white border rounded-b-lg shadow p-8 mb-8 text-base">
          {loadingDevis ? (
            <div>Chargement du devis...</div>
          ) : errorDevis ? (
            <div className="text-red-600">{errorDevis}</div>
          ) : !devis ? (
            <div className="text-gray-500">Aucun devis trouvé pour cette affaire (id=1).</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="px-3 py-2 border">Numéro devis</th>
                    <th className="px-3 py-2 border">Affaire ID</th>
                    <th className="px-3 py-2 border">Demande ID</th>
                    <th className="px-3 py-2 border">Objet</th>
                    <th className="px-3 py-2 border">Table établissement</th>
                    <th className="px-3 py-2 border">État</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-3 py-2 border">{devis.numero_devis || '-'}</td>
                    <td className="px-3 py-2 border">{devis.affaire_id || '-'}</td>
                    <td className="px-3 py-2 border">{devis.demande_id || '-'}</td>
                    <td className="px-3 py-2 border">{devis.objet || '-'}</td>
                    <td className="px-3 py-2 border">{devis.table_etablissement || '-'}</td>
                    <td className="px-3 py-2 border">{devis.etat || '-'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      <div className="w-full max-w-full mx-auto mt-4">
        <div className="bg-blue-900 rounded-t-lg px-6 py-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Notes Travaux</h2>
          <Link href={`/affaires/${affaire.numero_affaire}/notes-travaux`} className="text-xs text-blue-200 hover:text-white underline ml-2">
            Voir la page Note Travaux
          </Link>
        </div>
        <div className="bg-white border rounded-b-lg shadow p-8 mb-8 text-base">
          {loadingNotesTravaux ? (
            <div>Chargement des notes travaux...</div>
          ) : errorNotesTravaux ? (
            <div className="text-red-600">{errorNotesTravaux}</div>
          ) : notesTravaux.length === 0 ? (
            <div className="text-gray-500">Aucune note travaux trouvée pour cette affaire.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border text-sm">
                <thead>
                  <tr className="bg-blue-100">
                    <th className="px-3 py-2 border">Note</th>
                    <th className="px-3 py-2 border">Numéro d'affaire</th>
                    <th className="px-3 py-2 border">Libellé</th>
                    <th className="px-3 py-2 border">Date de création</th>
                    <th className="px-3 py-2 border">État</th>
                  </tr>
                </thead>
                <tbody>
                  {notesTravaux.map((n) => (
                    <tr key={n.id} className="border-b last:border-b-0">
                      <td className="px-3 py-2 border">{n.note || '-'}</td>
                      <td className="px-3 py-2 border">{n.affaire_id || '-'}</td>
                      <td className="px-3 py-2 border">{n.libelle || '-'}</td>
                      <td className="px-3 py-2 border">{n.date_creation ? new Date(n.date_creation).toLocaleDateString() : '-'}</td>
                      <td className="px-3 py-2 border">{n.etat || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      <div className="w-full max-w-full mx-auto mt-4">
        <div className="bg-red-600 rounded-t-lg px-6 py-5">
          <h2 className="text-lg font-bold text-white">Commentaires</h2>
        </div>
        <div className="bg-white border rounded-b-lg shadow p-8 mb-8 text-base">
        </div>
      </div>
      <div className="w-full max-w-full mx-auto mt-4">
        <div className="bg-gray-800 rounded-t-lg px-6 py-5">
          <h2 className="text-lg font-bold text-white">Historique des modifications</h2>
        </div>
        <div className="bg-white border rounded-b-lg shadow p-8 mb-8 text-base">
        </div>
      </div>
    </div>
  );
} 