"use client";
import Link from "next/link";
import ThemeToggle from "./ThemeToggle";

export default function TopNavBar() {
  return (
    <>
      {/* Bandeau horizontal */}
      <header className="w-full bg-gray-100 dark:bg-gray-900 py-3 px-0 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 px-4 md:px-8">
          {/* Logo SNCF */}
          <div className="flex items-center gap-4 min-w-[60px]">
            <img src="/logo_sncf.jpeg" alt="Logo SNCF" className="h-14 w-auto object-contain" />
            <div className="flex flex-col justify-center">
              <span className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white leading-tight">GIST</span>
              <span className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mt-0.5">Gestion des Imputations et Suivi Travaux</span>
            </div>
          </div>
          {/* Etablissement à droite */}
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <div className="flex-shrink-0 text-xs md:text-sm text-gray-500 dark:text-gray-400 font-medium text-right">
              Établissement : ESTI-sncf
            </div>
          </div>
        </div>
      </header>
      
      {/* Bandeau navigation secondaire */}
      <nav className="w-full bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 px-4 md:px-8 h-12">
          <span className="font-bold text-lg text-gray-800 dark:text-white">GIST</span>
          <div className="flex flex-wrap md:flex-nowrap gap-2 md:gap-4 overflow-x-auto">
            {[
              { label: "Accueil", href: "/home-page" },
              { label: "Demandes", href: "/demandes" },
              { label: "Affaires", href: "/project-selection" },
              { label: "Devis" },
              { label: "Notes Travaux" },
              { label: "Interventions" },
              { label: "Rechercher" },
              { label: "Suivi des affaires" },
              { label: "Aide", href: "/home-page/aide" },
              // Les entrées Risques, Contacts et Timeline ont été supprimées car tout est sur la synthèse
            ]
              // On filtre explicitement tout ce qui serait Contacts, Risques ou Timeline
              .filter(item => !["Contacts", "Risques", "Timeline"].includes(item.label))
              .map((item) => (
                item.href ? (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="bg-transparent border-none px-2 py-1 text-gray-700 dark:text-gray-300 hover:text-gist-blue dark:hover:text-blue-400 hover:underline transition-colors font-medium text-sm md:text-base cursor-pointer focus:outline-none"
                    style={{ outline: "none" }}
                  >
                    {item.label}
                  </Link>
                ) : (
                  <button
                    key={item.label}
                    type="button"
                    className="bg-transparent border-none px-2 py-1 text-gray-700 dark:text-gray-300 hover:text-gist-blue dark:hover:text-blue-400 hover:underline transition-colors font-medium text-sm md:text-base cursor-pointer focus:outline-none"
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