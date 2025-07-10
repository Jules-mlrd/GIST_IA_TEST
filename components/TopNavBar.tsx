"use client";
import Link from "next/link";
import { useState } from "react";

export default function TopNavBar() {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch('/api/api_database/affaires/sync-s3');
      const data = await res.json();
      if (data.success) {
        setSyncResult(`Synchronisation terminée : ${data.report.length} affaire(s) synchronisée(s).`);
      } else {
        setSyncResult(`Erreur : ${data.error || 'Synchronisation échouée.'}`);
      }
    } catch (e: any) {
      setSyncResult(`Erreur : ${e.message || 'Synchronisation échouée.'}`);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <>
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
      {/* Bouton synchronisation S3 */}
      <div className="w-full bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto flex items-center justify-end gap-4 px-4 md:px-8 h-12">
          <button
            className="bg-gist-blue text-white px-4 py-2 rounded shadow hover:bg-blue-700 text-sm font-semibold"
            onClick={handleSync}
            disabled={syncing}
          >
            {syncing ? 'Synchronisation...' : 'Synchroniser S3'}
          </button>
          {syncResult && <span className="ml-4 text-sm text-gist-blue">{syncResult}</span>}
        </div>
      </div>
      {/* Bandeau navigation secondaire */}
      <nav className="w-full bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 px-4 md:px-8 h-12">
          <span className="font-bold text-lg text-gray-800">GIST</span>
          <div className="flex flex-wrap md:flex-nowrap gap-2 md:gap-4 overflow-x-auto">
            {[
              { label: "Accueil", href: "/help-center" },
              { label: "Demandes", href: "/demandes" },
              { label: "Affaires", href: "/project-selection" },
              { label: "Devis" },
              { label: "Notes Travaux" },
              { label: "Interventions" },
              { label: "Rechercher" },
              { label: "Suivi des affaires" },
              { label: "Aide" },
            ].map((item) => (
              item.href ? (
                <Link
                  key={item.label}
                  href={item.href}
                  className="bg-transparent border-none px-2 py-1 text-gray-700 hover:text-gist-blue hover:underline transition-colors font-medium text-sm md:text-base cursor-pointer focus:outline-none"
                  style={{ outline: "none" }}
                >
                  {item.label}
                </Link>
              ) : (
                <button
                  key={item.label}
                  type="button"
                  className="bg-transparent border-none px-2 py-1 text-gray-700 hover:text-gist-blue hover:underline transition-colors font-medium text-sm md:text-base cursor-pointer focus:outline-none"
                  style={{ outline: "none" }}
                >
                  {item.label}
                </button>
              )
            ))}
          </div>
        </div>
      </nav>
    </>
  );
} 