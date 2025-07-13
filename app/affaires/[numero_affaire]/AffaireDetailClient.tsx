'use client';
import { useAffaireChatbot } from '@/hooks/useAffaireChatbot';
import { ChatBot } from '@/components/chatbot';
import AffaireFilesClient from './AffaireFilesClient';
import { useState } from 'react';
import { X } from 'lucide-react';
import Link from "next/link";

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

  return (
    <div className="relative py-8 px-2">
      {/* Onglets de navigation affaire */}
      <nav className="flex gap-2 mb-8 border-b pb-2">
        <Link href={`/affaires/${affaire.numero_affaire}`}
          className="px-4 py-2 rounded-t-lg font-semibold text-gray-700 hover:bg-gray-100 border-b-2 border-transparent hover:border-blue-400 transition">
          Détail
        </Link>
        <button
          onClick={() => setShowFiles(v => !v)}
          className={`px-4 py-2 rounded-t-lg font-semibold text-gray-700 hover:bg-gray-100 border-b-2 border-transparent hover:border-violet-400 transition ${showFiles ? 'border-violet-600 bg-violet-50' : ''}`}
        >
          Fichiers
        </button>
        <Link href={`/ai-dashboard?affaire=${affaire.numero_affaire}`}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 rounded-t-lg font-semibold text-blue-700 hover:bg-blue-50 border-b-2 border-transparent hover:border-blue-600 transition">
          Dashboard IA
        </Link>
        <Link href={`/risks?affaire=${affaire.numero_affaire}`}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 rounded-t-lg font-semibold text-orange-700 hover:bg-orange-50 border-b-2 border-transparent hover:border-orange-600 transition">
          Risques
        </Link>
      </nav>
      <div className="w-full bg-black px-6 py-4 mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-white text-center whitespace-nowrap overflow-x-auto">
          {affaire.titre || 'Affaire'} ({affaire.numero_affaire})
        </h1>
      </div>
      <div className="flex flex-col md:flex-row w-full max-w-full mx-auto gap-4">
        {/* Bloc infos à gauche */}
        <div className="w-full md:w-1/2">
          <div className="bg-green-600 rounded-t-lg px-6 py-5">
            <h2 className="text-lg font-bold text-white">Informations générales</h2>
          </div>
          <div className="bg-white border rounded-b-lg shadow p-8 mb-8">
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
        {/* Bloc fichiers à droite */}
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
          <div className="bg-white border rounded-b-lg shadow p-8 mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="font-semibold text-gray-700 text-lg">Fichiers de l'affaire</div>
              {showFiles && (
                <button
                  className="ml-2 p-1 rounded hover:bg-violet-100 text-violet-700"
                  aria-label="Fermer les fichiers"
                  onClick={() => setShowFiles(false)}
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
            <div className="mb-4">
              <div className="font-semibold text-gray-700 mb-1">URL</div>
              {affaire.s3_folder ? (
                <a href={affaire.s3_folder} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-all">{affaire.s3_folder}</a>
              ) : (
                <span className="text-gray-400">Non renseigné</span>
              )}
            </div>
            <button
              className="bg-violet-600 hover:bg-violet-700 text-white font-semibold px-4 py-2 rounded shadow mb-4"
              onClick={() => setShowFiles(v => !v)}
            >
              {showFiles ? 'Masquer les fichiers' : 'Afficher les fichiers'}
            </button>
            {showFiles && (
              <div className="mt-4">
                <AffaireFilesClient numero_affaire={affaire.numero_affaire} />
              </div>
            )}
          </div>
          {/* ChatBot flottant classique */}
          <ChatBot affaireId={affaire.numero_affaire} files={files} loading={loading} />
        </div>
      </div>
      {/* Bloc Demande client */}
      <div className="w-full max-w-full mx-auto mt-4">
        <div className="bg-orange-500 rounded-t-lg px-6 py-5">
          <h2 className="text-lg font-bold text-white">Demande client</h2>
        </div>
        <div className="bg-white border rounded-b-lg shadow p-8 mb-8">
          {/* Contenu à venir */}
        </div>
      </div>
      {/* Bloc Devis */}
      <div className="w-full max-w-full mx-auto mt-4">
        <div className="bg-gray-800 rounded-t-lg px-6 py-5">
          <h2 className="text-lg font-bold text-white">Devis</h2>
        </div>
        <div className="bg-white border rounded-b-lg shadow p-8 mb-8">
          {/* Contenu à venir */}
        </div>
      </div>
      {/* Bloc Notes Travaux */}
      <div className="w-full max-w-full mx-auto mt-4">
        <div className="bg-blue-900 rounded-t-lg px-6 py-5">
          <h2 className="text-lg font-bold text-white">Notes Travaux</h2>
        </div>
        <div className="bg-white border rounded-b-lg shadow p-8 mb-8">
          {/* Contenu à venir */}
        </div>
      </div>
      {/* Bloc Commentaires */}
      <div className="w-full max-w-full mx-auto mt-4">
        <div className="bg-red-600 rounded-t-lg px-6 py-5">
          <h2 className="text-lg font-bold text-white">Commentaires</h2>
        </div>
        <div className="bg-white border rounded-b-lg shadow p-8 mb-8">
          {/* Contenu à venir */}
        </div>
      </div>
      {/* Bloc Historique des modifications */}
      <div className="w-full max-w-full mx-auto mt-4">
        <div className="bg-gray-800 rounded-t-lg px-6 py-5">
          <h2 className="text-lg font-bold text-white">Historique des modifications</h2>
        </div>
        <div className="bg-white border rounded-b-lg shadow p-8 mb-8">
          {/* Contenu à venir */}
        </div>
      </div>
    </div>
  );
} 