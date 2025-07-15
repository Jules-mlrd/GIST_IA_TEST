import React from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
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
            <Link href="/home-page" className="w-full">
              <Button className="w-full bg-gray-100 hover:bg-gray-200 text-[#E2001A] text-base font-medium py-3 rounded-md shadow">Aide &amp; Documentation</Button>
            </Link>
          </div>
        </Card>
      </main>
    </div>
  );
}
