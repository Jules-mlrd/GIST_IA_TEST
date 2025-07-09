import React from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function TopNavBar() {
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
      {/* Bandeau navigation secondaire */}
      <nav className="w-full bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 px-4 md:px-8 h-12">
          <span className="font-bold text-lg text-gray-800">GIST</span>
          <div className="flex flex-wrap md:flex-nowrap gap-2 md:gap-4 overflow-x-auto">
            {[
              { label: "Accueil", href: "/help-center" },
              { label: "Demandes" },
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

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNavBar />
      {/* Contenu principal */}
      <main className="flex-1 w-full flex flex-col items-center justify-center py-10 px-2">
        <Card className="w-full max-w-xl mx-auto p-10 bg-white border border-gray-200 rounded-2xl shadow-lg flex flex-col items-center">
          <img src="/logo_sncf.jpeg" alt="Logo SNCF" className="h-24 w-auto mb-4" />
          <h1 className="text-4xl font-extrabold text-[#E2001A] mb-1 tracking-tight">GIST</h1>
          <p className="text-base text-gray-700 mb-1 font-medium">Gestion des Imputations et Suivi Travaux</p>
          <p className="text-center text-gray-600 text-lg mb-6 max-w-md">
            Bienvenue sur la plateforme professionnelle de gestion et de suivi des affaires SNCF.<br/>
            Accédez à vos projets, documents et outils de pilotage en toute simplicité et sécurité.
          </p>
          <div className="flex flex-col gap-4 w-full mt-2">
            <Link href="/project-selection" className="w-full">
              <Button className="w-full bg-[#E2001A] hover:bg-[#b80015] text-white text-lg font-semibold py-3 rounded-md shadow">Sélection d'affaire</Button>
            </Link>
            <Link href="/ai-dashboard" className="w-full">
              <Button className="w-full bg-[#E2001A]/90 hover:bg-[#b80015]/90 text-white text-base font-medium py-3 rounded-md shadow">Tableau de bord IA</Button>
            </Link>
            <Link href="/help-center" className="w-full">
              <Button className="w-full bg-gray-100 hover:bg-gray-200 text-[#E2001A] text-base font-medium py-3 rounded-md shadow">Aide &amp; Documentation</Button>
            </Link>
          </div>
        </Card>
      </main>
    </div>
  );
}
