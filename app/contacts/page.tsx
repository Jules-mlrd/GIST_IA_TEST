"use client"

import { Layout } from "@/components/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Mail, Phone, UserPlus, Search } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const teamMembers = [
  {
    name: "Marie Dubois",
    role: "Chef de projet",
    email: "m.dubois@sncf.fr",
    phone: "01 23 45 67 89",
    department: "Direction des Projets",
    avatar: "MD",
  },
  {
    name: "Jean Martin",
    role: "Ingénieur technique",
    email: "j.martin@sncf.fr",
    phone: "01 23 45 67 90",
    department: "Direction Technique",
    avatar: "JM",
  },
  {
    name: "Sophie Bernard",
    role: "Responsable financier",
    email: "s.bernard@sncf.fr",
    phone: "01 23 45 67 91",
    department: "Direction Financière",
    avatar: "SB",
  },
  {
    name: "Thomas Petit",
    role: "Ingénieur sécurité",
    email: "t.petit@sncf.fr",
    phone: "01 23 45 67 92",
    department: "Direction Sécurité",
    avatar: "TP",
  },
  {
    name: "Claire Moreau",
    role: "Responsable communication",
    email: "c.moreau@sncf.fr",
    phone: "01 23 45 67 93",
    department: "Direction Communication",
    avatar: "CM",
  },
]

const externalContacts = [
  {
    name: "Philippe Durand",
    company: "Fournisseur A",
    role: "Responsable commercial",
    email: "p.durand@fournisseura.com",
    phone: "01 98 76 54 32",
    avatar: "PD",
  },
  {
    name: "Isabelle Leroy",
    company: "Consultant B",
    role: "Consultante senior",
    email: "i.leroy@consultantb.com",
    phone: "01 98 76 54 33",
    avatar: "IL",
  },
]

export default function ContactsPage() {
  return (
    <Layout title="Contacts" subtitle="Équipe projet et contacts externes">
      <div className="flex justify-end items-center mb-4">
        <Button className="bg-sncf-red hover:bg-red-700">
          <UserPlus className="mr-2 h-4 w-4" />
          Ajouter un contact
        </Button>
      </div>

      <Tabs defaultValue="team" className="w-full">
        <TabsList>
          <TabsTrigger value="team">Équipe projet</TabsTrigger>
          <TabsTrigger value="external">Contacts externes</TabsTrigger>
        </TabsList>

        <TabsContent value="team" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teamMembers.map((member, index) => (
              <Card key={index}>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-sncf-red text-white">{member.avatar}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{member.name}</h3>
                      <p className="text-sm text-gray-500">{member.role}</p>
                      <Badge variant="outline" className="mt-1">
                        {member.department}
                      </Badge>
                      <div className="mt-3 space-y-1">
                        <div className="flex items-center text-sm">
                          <Mail className="h-3.5 w-3.5 mr-2 text-gray-500" />
                          <a href={`mailto:${member.email}`} className="text-gray-600 hover:text-sncf-red">
                            {member.email}
                          </a>
                        </div>
                        <div className="flex items-center text-sm">
                          <Phone className="h-3.5 w-3.5 mr-2 text-gray-500" />
                          <a href={`tel:${member.phone}`} className="text-gray-600 hover:text-sncf-red">
                            {member.phone}
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="external" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {externalContacts.map((contact, index) => (
              <Card key={index}>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-gray-200 text-gray-700">{contact.avatar}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{contact.name}</h3>
                      <p className="text-sm text-gray-500">{contact.role}</p>
                      <Badge variant="secondary" className="mt-1">
                        {contact.company}
                      </Badge>
                      <div className="mt-3 space-y-1">
                        <div className="flex items-center text-sm">
                          <Mail className="h-3.5 w-3.5 mr-2 text-gray-500" />
                          <a href={`mailto:${contact.email}`} className="text-gray-600 hover:text-sncf-red">
                            {contact.email}
                          </a>
                        </div>
                        <div className="flex items-center text-sm">
                          <Phone className="h-3.5 w-3.5 mr-2 text-gray-500" />
                          <a href={`tel:${contact.phone}`} className="text-gray-600 hover:text-sncf-red">
                            {contact.phone}
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </Layout>
  )
}
