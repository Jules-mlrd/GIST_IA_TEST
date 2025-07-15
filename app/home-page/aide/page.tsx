"use client";

import React, { useState } from "react";

export default function AidePage() {
  const [form, setForm] = useState({ nom: "", email: "", sujet: "", message: "" });
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState<string|null>(null);
  const [error, setError] = useState<string|null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setSuccess(null);
    setError(null);
    try {
      const res = await fetch("/api/send-support-mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          subject: form.sujet,
          message: `Nom: ${form.nom}\nEmail: ${form.email}\n\n${form.message}`
        })
      });
      const data = await res.json();
      if (data.success) setSuccess("Votre message a bien été envoyé. Nous vous répondrons rapidement.");
      else setError(data.error || "Erreur lors de l'envoi du message.");
    } catch (e: any) {
      setError(e.message || "Erreur lors de l'envoi du message.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-10 px-2">
      <div className="w-full max-w-xl bg-white border border-gray-200 rounded-2xl shadow-lg p-8 mb-8">
        <h1 className="text-3xl font-bold text-[#E2001A] mb-2">Aide &amp; Support</h1>
        <p className="text-gray-700 mb-6">Remplissez ce formulaire pour contacter le support technique ou poser une question.</p>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Votre nom"
            className="border rounded px-3 py-2"
            required
            value={form.nom}
            onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
          />
          <input
            type="email"
            placeholder="Votre email"
            className="border rounded px-3 py-2"
            required
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          />
          <input
            type="text"
            placeholder="Sujet"
            className="border rounded px-3 py-2"
            required
            value={form.sujet}
            onChange={e => setForm(f => ({ ...f, sujet: e.target.value }))}
          />
          <textarea
            placeholder="Votre message"
            className="border rounded px-3 py-2 min-h-[100px]"
            required
            value={form.message}
            onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
          />
          <button
            type="submit"
            className="bg-[#E2001A] text-white font-semibold py-2 rounded hover:bg-[#b80015] transition"
            disabled={sending}
          >
            {sending ? "Envoi en cours..." : "Envoyer"}
          </button>
          {success && <div className="text-green-600 font-medium mt-2">{success}</div>}
          {error && <div className="text-red-600 font-medium mt-2">{error}</div>}
        </form>
      </div>
      <div className="w-full max-w-xl bg-white border border-gray-200 rounded-2xl shadow-lg p-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">FAQ - Questions fréquentes</h2>
        <ul className="space-y-4">
          <li>
            <strong>Comment accéder à mes affaires&nbsp;?</strong>
            <div className="text-gray-700">(Réponse à définir)</div>
          </li>
          <li>
            <strong>Comment déposer un document&nbsp;?</strong>
            <div className="text-gray-700">(Réponse à définir)</div>
          </li>
          <li>
            <strong>Comment contacter le support&nbsp;?</strong>
            <div className="text-gray-700">Utilisez le formulaire ci-dessus pour nous écrire directement.</div>
          </li>
        </ul>
      </div>
    </div>
  );
} 