"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Mail, Phone } from "lucide-react"
import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useRouter } from "next/navigation"
import AffaireLayout from "@/components/AffaireLayout";

function getFullName(contact: any) {
  if (contact.prenom || contact.nom) {
    return [contact.prenom, contact.nom].filter(Boolean).join(" ")
  }
  return contact.name || "Nom inconnu"
}

// Fonction utilitaire pour formater les numéros de téléphone français
function formatPhoneNumber(phone: string): string {
  if (!phone) return '';
  // Nettoyage : on enlève tout sauf les chiffres
  let cleaned = phone.replace(/[^\d+]/g, '');
  // Format international +33...
  if (cleaned.startsWith('33')) cleaned = '+' + cleaned;
  if (cleaned.startsWith('0033')) cleaned = '+33' + cleaned.slice(4);
  if (cleaned.startsWith('0')) cleaned = cleaned.slice(1);
  if (cleaned.startsWith('+33')) {
    // +33 X XX XX XX XX
    return cleaned.replace(/^\+33(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/, '+33 $1 $2 $3 $4 $5');
  }
  // Format national 0X XX XX XX XX
  if (cleaned.length === 9) cleaned = '0' + cleaned;
  return cleaned.replace(/^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/, '$1 $2 $3 $4 $5');
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const searchParams = useSearchParams();
  const router = useRouter();
  const affaire = searchParams?.get("affaire") || "";
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const fetchAffaireContacts = async () => {
      setLoading(true)
      setError(null)
      try {
        if (!affaire) {
          setError("Aucune affaire sélectionnée.");
          setContacts([]);
          setLoading(false);
          return;
        }
        const res = await fetch(`/api/contacts?affaire=${encodeURIComponent(affaire)}`)
        if (!res.ok) throw new Error("Erreur lors de la récupération des contacts de l'affaire")
        const data = await res.json()
        setContacts(data.contacts || [])
      } catch (e: any) {
        setError(e.message)
        setContacts([])
      } finally {
        setLoading(false)
      }
    }
    fetchAffaireContacts()
  }, [affaire])

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

  return (
    <AffaireLayout numero_affaire={affaire} active="contacts">
      <div className="flex items-center gap-3 mb-10">
        <div className="bg-sncf-red rounded-full p-3 flex items-center justify-center">
          <Mail className="h-7 w-7 text-white" />
        </div>
        <h1 className="text-lg font-bold text-sncf-red tracking-tight">Contacts de l'affaire</h1>
      </div>
      <div className="mb-10 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <Input
          type="text"
          placeholder="Rechercher un contact..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-md border-gray-300 text-base shadow-sm"
        />
      </div>
      {loading && <div className="text-gray-500 text-base">Chargement des contacts extraits des fichiers de l'affaire...</div>}
      {error && <div className="text-red-600 font-semibold text-base">{error}</div>}
      {!loading && !error && (
        <div className="flex flex-col gap-8">
          {filteredContacts.length === 0 && <div className="text-gray-400 text-center text-base">Aucun contact trouvé dans les fichiers de l'affaire.</div>}
          {filteredContacts.map((contact, index) => (
            <Card key={index} className="shadow-lg border-0 bg-white w-full">
              <CardContent className="flex flex-row items-center gap-8 p-8 min-h-[120px] w-full">
                <Avatar className="h-16 w-16 min-w-16">
                  <AvatarFallback className="bg-sncf-red text-white text-base font-bold">
                    {getFullName(contact).split(" ").map((n: string) => n[0]).join("") || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-base text-gray-900 truncate" title={getFullName(contact)}>{getFullName(contact)}</h3>
                  {contact.role && <div className="text-sm text-gray-500 truncate" title={contact.role}>{contact.role}</div>}
                  {contact.societe && <div className="text-sm text-gray-400 truncate" title={contact.societe}>{contact.societe}</div>}
                  <div className="mt-2 flex flex-row gap-8 flex-wrap items-center">
                    {contact.email && (
                      <div className="flex items-center text-base truncate" title={contact.email}>
                        <Mail className="h-4 w-4 mr-2 text-gray-500" />
                        <a href={`mailto:${contact.email}`} className="text-gray-700 hover:text-sncf-red truncate" style={{maxWidth:'320px', display:'inline-block', verticalAlign:'bottom', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                          {contact.email}
                        </a>
                      </div>
                    )}
                    {contact.telephone && (
                      <div className="flex items-center text-base truncate" title={formatPhoneNumber(contact.telephone)}>
                        <Phone className="h-4 w-4 mr-2 text-gray-500" />
                        <a href={`tel:${contact.telephone}`} className="text-gray-700 hover:text-sncf-red truncate" style={{maxWidth:'200px', display:'inline-block', verticalAlign:'bottom', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                          {formatPhoneNumber(contact.telephone)}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AffaireLayout>
  )
}
