"use client"

import { Layout } from "@/components/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Mail, Phone, UserPlus, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"

function isInternal(email?: string) {
  return email && email.endsWith("@sncf.fr")
}

function getFullName(contact: any) {
  if (contact.prenom || contact.nom) {
    return [contact.prenom, contact.nom].filter(Boolean).join(" ")
  }
  return contact.name || "Nom inconnu"
}

const emptyContact = { prenom: "", nom: "", email: "", telephone: "", societe: "", role: "" }

const CACHE_KEY = 'contacts_cache_v1';
const CACHE_EXPIRATION_MS = 10 * 60 * 1000; // 10 minutes

export default function ContactsPage() {
  const [contacts, setContacts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...emptyContact })
  const [formError, setFormError] = useState<string | null>(null)
  const [formLoading, setFormLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null)

  const fetchContacts = async () => {
    setLoading(true)
    setError(null)
    try {
      const cached = typeof window !== 'undefined' ? localStorage.getItem(CACHE_KEY) : null;
      if (cached) {
        const { contacts: cachedContacts, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_EXPIRATION_MS) {
          setContacts(cachedContacts || []);
          setLoading(false);
          return;
        }
      }
      const res = await fetch("/api/contacts")
      if (!res.ok) throw new Error("Erreur lors de la récupération des contacts")
      const data = await res.json()
      setContacts(data.contacts || [])
      if (typeof window !== 'undefined') {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ contacts: data.contacts || [], timestamp: Date.now() }))
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchContacts()
  }, [])

  const filteredContacts = contacts.filter(contact => {
    const q = search.toLowerCase()
    return (
      getFullName(contact).toLowerCase().includes(q) ||
      (contact.email && contact.email.toLowerCase().includes(q)) ||
      (contact.telephone && contact.telephone.toLowerCase().includes(q)) ||
      (contact.societe && contact.societe.toLowerCase().includes(q)) ||
      (contact.role && contact.role.toLowerCase().includes(q))
    )
  })

  const internalContacts = filteredContacts.filter(c => isInternal(c.email))
  const externalContacts = filteredContacts.filter(c => !isInternal(c.email))

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!form.email && !form.telephone) {
      setFormError("Email ou téléphone requis.")
      return
    }
    setFormLoading(true)
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      })
      if (!res.ok) {
        const data = await res.json()
        setFormError(data.error || "Erreur lors de l'ajout")
      } else {
        setShowForm(false)
        setForm({ ...emptyContact })
        await fetchContacts()
      }
    } catch {
      setFormError("Erreur lors de l'ajout")
    } finally {
      setFormLoading(false)
    }
  }

  const handleDeleteContact = async (contact: any) => {
    setDeleteLoading((contact.email || contact.telephone) ?? '')
    try {
      const res = await fetch('/api/contacts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: contact.email, telephone: contact.telephone })
      })
      await fetchContacts()
    } finally {
      setDeleteLoading(null)
    }
  }

  function isManualContact(contact: any) {
    
    return true
  }

  return (
    <Layout title="Contacts" subtitle="Contacts extraits automatiquement des documents du projet">
      <div className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <Button className="bg-sncf-red hover:bg-red-700" onClick={() => setShowForm(v => !v)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Ajouter un contact
        </Button>
        <Input
          type="text"
          placeholder="Rechercher un contact..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-xs"
        />
      </div>
      {showForm && (
        <form onSubmit={handleAddContact} className="mb-6 p-4 border rounded bg-gray-50 flex flex-col gap-2 max-w-xl">
          <div className="flex gap-2">
            <Input name="prenom" placeholder="Prénom" value={form.prenom} onChange={handleFormChange} />
            <Input name="nom" placeholder="Nom" value={form.nom} onChange={handleFormChange} />
          </div>
          <div className="flex gap-2">
            <Input name="email" placeholder="Email" value={form.email} onChange={handleFormChange} type="email" />
            <Input name="telephone" placeholder="Téléphone" value={form.telephone} onChange={handleFormChange} />
          </div>
          <div className="flex gap-2">
            <Input name="societe" placeholder="Société" value={form.societe} onChange={handleFormChange} />
            <Input name="role" placeholder="Rôle" value={form.role} onChange={handleFormChange} />
          </div>
          {formError && <div className="text-red-600 text-sm">{formError}</div>}
          <div className="flex gap-2 mt-2">
            <Button type="submit" className="bg-sncf-red" disabled={formLoading}>
              {formLoading ? "Ajout..." : "Ajouter"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setShowForm(false)} disabled={formLoading}>
              Annuler
            </Button>
          </div>
        </form>
      )}
      {loading && <div>Chargement des contacts...</div>}
      {error && <div className="text-red-600">{error}</div>}
      {!loading && !error && (
        <>
          <h2 className="text-lg font-semibold mb-2 mt-4">Équipe projet (SNCF)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {internalContacts.length === 0 && <div>Aucun contact interne trouvé.</div>}
            {internalContacts.map((contact, index) => (
              <Card key={index}>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-sncf-red text-white">
                        {getFullName(contact).split(" ").map((n: string) => n[0]).join("") || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{getFullName(contact)}</h3>
                      {contact.role && <div className="text-sm text-gray-500">{contact.role}</div>}
                      {contact.societe && <div className="text-xs text-gray-400">{contact.societe}</div>}
                      <div className="mt-3 space-y-1">
                        {contact.email && (
                          <div className="flex items-center text-sm">
                            <Mail className="h-3.5 w-3.5 mr-2 text-gray-500" />
                            <a href={`mailto:${contact.email}`} className="text-gray-600 hover:text-sncf-red">
                              {contact.email}
                            </a>
                          </div>
                        )}
                        {contact.telephone && (
                          <div className="flex items-center text-sm">
                            <Phone className="h-3.5 w-3.5 mr-2 text-gray-500" />
                            <a href={`tel:${contact.telephone}`} className="text-gray-600 hover:text-sncf-red">
                              {contact.telephone}
                            </a>
                          </div>
                        )}
                      </div>
                      {isManualContact(contact) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-600 hover:bg-red-100 ml-auto mt-2"
                          onClick={() => handleDeleteContact(contact)}
                          disabled={deleteLoading === (contact.email || contact.telephone)}
                          title="Supprimer le contact"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <h2 className="text-lg font-semibold mb-2 mt-8">Contacts externes</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {externalContacts.length === 0 && <div>Aucun contact externe trouvé.</div>}
            {externalContacts.map((contact, index) => (
              <Card key={index}>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-gray-200 text-gray-700">
                        {getFullName(contact).split(" ").map((n: string) => n[0]).join("") || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{getFullName(contact)}</h3>
                      {contact.role && <div className="text-sm text-gray-500">{contact.role}</div>}
                      {contact.societe && <div className="text-xs text-gray-400">{contact.societe}</div>}
                      <div className="mt-3 space-y-1">
                        {contact.email && (
                          <div className="flex items-center text-sm">
                            <Mail className="h-3.5 w-3.5 mr-2 text-gray-500" />
                            <a href={`mailto:${contact.email}`} className="text-gray-600 hover:text-sncf-red">
                              {contact.email}
                            </a>
                          </div>
                        )}
                        {contact.telephone && (
                          <div className="flex items-center text-sm">
                            <Phone className="h-3.5 w-3.5 mr-2 text-gray-500" />
                            <a href={`tel:${contact.telephone}`} className="text-gray-600 hover:text-sncf-red">
                              {contact.telephone}
                            </a>
                          </div>
                        )}
                      </div>
                      {isManualContact(contact) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-600 hover:bg-red-100 ml-auto mt-2"
                          onClick={() => handleDeleteContact(contact)}
                          disabled={deleteLoading === (contact.email || contact.telephone)}
                          title="Supprimer le contact"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </Layout>
  )
}
