"use client"

import React, { useState } from "react";
import { Shield, FileText, ClipboardList, Users } from "lucide-react";

export default function LoginPage() {
  const [tab, setTab] = useState<'client' | 'collaborator'>('client');
  const [clientUsername, setClientUsername] = useState("");
  const [clientPassword, setClientPassword] = useState("");
  const [collaboratorUsername, setCollaboratorUsername] = useState("");
  const [collaboratorPassword, setCollaboratorPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function validateCredentials(username: string, password: string) {
    const res = await fetch("/api/auth/validate-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    return data.valid;
  }

  const handleClientLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const isValid = await validateCredentials(clientUsername, clientPassword);
    if (!isValid) {
      setIsLoading(false);
      alert("Identifiant ou mot de passe incorrect.");
      return;
    }
    localStorage.setItem("gist-authenticated", "true");
    localStorage.setItem("gist-user", clientUsername || "Client");
    localStorage.setItem("gist-user-type", "client");
    // Simule un projet client par défaut
    const clientProject = {
      id: "GIST-2024-001",
      name: "Ligne à grande vitesse Lyon–Paris",
      description: "Modernisation des infrastructures ferroviaires sur la ligne Lyon-Paris",
      status: "active",
      progress: 68,
      manager: "Marie Dubois",
      department: "Direction Générale des Infrastructures",
      startDate: "Jan 2024",
      endDate: "Dec 2024",
      isFullyImplemented: true,
    };
    localStorage.setItem("gist-selected-project", JSON.stringify(clientProject));
    window.location.href = "/help-center";
  };

  const handleCollaboratorLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const isValid = await validateCredentials(collaboratorUsername, collaboratorPassword);
    if (!isValid) {
      setIsLoading(false);
      alert("Identifiant ou mot de passe incorrect.");
      return;
    }
    localStorage.setItem("gist-authenticated", "true");
    localStorage.setItem("gist-user", collaboratorUsername || "Collaborateur");
    localStorage.setItem("gist-user-type", "collaborator");
    window.location.href = "/help-center";
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        {/* Colonne gauche : branding + carrés informatifs */}
        <div className="flex flex-col items-center md:items-start gap-6">
          <img src="/logo_sncf.jpeg" alt="Logo SNCF" className="h-24 w-auto mb-2" />
          <h1 className="text-4xl font-extrabold text-[#E2001A] mb-1 tracking-tight">GIST</h1>
          <p className="text-lg text-gray-700 mb-1 font-medium">Suivi des affaires et travaux</p>
          <span className="text-xs text-gray-400 mb-2">Plateforme SNCF</span>
          <div className="bg-[#E2001A]/10 border border-[#E2001A]/20 rounded-lg px-6 py-3 text-center text-[#E2001A] font-semibold text-base max-w-xs">
            Bienvenue sur la plateforme de gestion et de suivi des affaires SNCF.
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 w-full max-w-md">
            <div className="flex items-center gap-3 p-4 bg-white rounded-lg shadow-sm border border-[#E2001A]/30">
              <ClipboardList className="h-6 w-6 text-[#E2001A]" />
              <div>
                <h3 className="font-medium text-[#E2001A]">Suivi des affaires</h3>
                <p className="text-sm text-gray-500">Gestion centralisée des dossiers</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-white rounded-lg shadow-sm border border-[#E2001A]/30">
              <FileText className="h-6 w-6 text-[#E2001A]" />
              <div>
                <h3 className="font-medium text-[#E2001A]">Suivi des travaux</h3>
                <p className="text-sm text-gray-500">Avancement et documentation</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-white rounded-lg shadow-sm border border-[#E2001A]/30">
              <Shield className="h-6 w-6 text-[#E2001A]" />
              <div>
                <h3 className="font-medium text-[#E2001A]">Sécurité</h3>
                <p className="text-sm text-gray-500">Données protégées SNCF</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-white rounded-lg shadow-sm border border-[#E2001A]/30">
              <Users className="h-6 w-6 text-[#E2001A]" />
              <div>
                <h3 className="font-medium text-[#E2001A]">Collaboration</h3>
                <p className="text-sm text-gray-500">Travail en équipe facilité</p>
              </div>
            </div>
          </div>
        </div>
        {/* Colonne droite : formulaire de connexion avec onglets */}
        <div className="flex justify-center">
          <div className="w-full max-w-sm bg-white rounded-xl shadow-lg p-8 border border-gray-200">
            <div className="flex justify-center mb-6">
              <button
                className={`px-4 py-2 rounded-l-md font-semibold text-base border border-[#E2001A] focus:outline-none transition ${tab === 'client' ? 'bg-[#E2001A] text-white' : 'bg-white text-[#E2001A]'}`}
                onClick={() => setTab('client')}
                type="button"
              >
                Client
              </button>
              <button
                className={`px-4 py-2 rounded-r-md font-semibold text-base border border-[#E2001A] border-l-0 focus:outline-none transition ${tab === 'collaborator' ? 'bg-[#E2001A] text-white' : 'bg-white text-[#E2001A]'}`}
                onClick={() => setTab('collaborator')}
                type="button"
              >
                Collaborateur
              </button>
            </div>
            {tab === 'client' && (
              <form onSubmit={handleClientLogin} className="flex flex-col gap-4">
                <div>
                  <label htmlFor="client-username" className="block text-gray-700 font-medium mb-1">Utilisateur</label>
                  <input
                    id="client-username"
                    name="client-username"
                    type="text"
                    autoComplete="username"
                    required
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#E2001A]"
                    placeholder="Votre identifiant"
                    value={clientUsername}
                    onChange={e => setClientUsername(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="client-password" className="block text-gray-700 font-medium mb-1">Mot de passe</label>
                  <input
                    id="client-password"
                    name="client-password"
                    type="password"
                    autoComplete="current-password"
                    required
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#E2001A]"
                    placeholder="Votre mot de passe"
                    value={clientPassword}
                    onChange={e => setClientPassword(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-[#E2001A] text-white font-semibold py-3 rounded-md shadow hover:bg-[#b80015] transition text-lg mt-2"
                  disabled={isLoading}
                >
                  {isLoading ? "Connexion..." : "Se connecter"}
                </button>
              </form>
            )}
            {tab === 'collaborator' && (
              <form onSubmit={handleCollaboratorLogin} className="flex flex-col gap-4">
                <div>
                  <label htmlFor="collaborator-username" className="block text-gray-700 font-medium mb-1">Utilisateur</label>
                  <input
                    id="collaborator-username"
                    name="collaborator-username"
                    type="text"
                    autoComplete="username"
                    required
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#E2001A]"
                    placeholder="Votre identifiant"
                    value={collaboratorUsername}
                    onChange={e => setCollaboratorUsername(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="collaborator-password" className="block text-gray-700 font-medium mb-1">Mot de passe</label>
                  <input
                    id="collaborator-password"
                    name="collaborator-password"
                    type="password"
                    autoComplete="current-password"
                    required
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#E2001A]"
                    placeholder="Votre mot de passe"
                    value={collaboratorPassword}
                    onChange={e => setCollaboratorPassword(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-[#E2001A] text-white font-semibold py-3 rounded-md shadow hover:bg-[#b80015] transition text-lg mt-2"
                  disabled={isLoading}
                >
                  {isLoading ? "Connexion..." : "Se connecter"}
                </button>
              </form>
            )}
            <div className="mt-6 text-center text-xs text-gray-400">
              © {new Date().getFullYear()} SNCF - GIST
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
