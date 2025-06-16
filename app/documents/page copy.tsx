"use client"

import { useEffect, useState } from "react"
import { Layout } from "@/components/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileDown, Download, FileText, FilePlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface S3Document {
  name: string
  key: string
  size: string
  lastModified: string
  type: string
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<S3Document[]>([])
  const [sortKey, setSortKey] = useState("date")

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const res = await fetch("/api/documents")
        const data = await res.json()
        if (res.ok && Array.isArray(data.documents)) {
          setDocuments(data.documents)
        } else {
          console.error("Réponse invalide:", data)
          setDocuments([])
        }
      } catch (err) {
        console.error("Erreur chargement documents:", err)
        setDocuments([])
      }
    }

    fetchDocuments()
  }, [])

  const sortedDocuments = Array.isArray(documents) ? [...documents].sort((a, b) => {
    if (sortKey === "date") return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
    if (sortKey === "name") return a.name.localeCompare(b.name)
    if (sortKey === "type") return a.type.localeCompare(b.type)
    if (sortKey === "size") return parseFloat(b.size) - parseFloat(a.size)
    return 0
  }) : []

  const getTabFromType = (type: string) => {
    const typeMap: Record<string, string> = {
      pdf: "reports",
      doc: "reports",
      docx: "reports",
      xls: "plans",
      xlsx: "plans",
      ppt: "specs",
      pptx: "specs",
      txt: "reports"
    }
    return typeMap[type.toLowerCase()] || "all"
  }

  const renderDocumentCards = (tab: string) => {
    return sortedDocuments
      .filter((doc) => tab === "all" || getTabFromType(doc.type) === tab)
      .map((doc, index) => (
        <div
          key={index}
          className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <FileDown className="h-4 w-4 text-gray-400" />
            <div>
              <div className="font-medium text-gray-900">{doc.name}</div>
              <div className="text-sm text-gray-500">
                {doc.lastModified} • {doc.size} • {doc.type}
              </div>
            </div>
          </div>
          <a
            href={`https://gism-documents.s3.eu-central-1.amazonaws.com/${doc.key}`}
            download
            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
          >
            <Download className="h-4 w-4 text-gray-600" />
          </a>
        </div>
      ))
  }

  return (
    <Layout title="Documents" subtitle="Gestion documentaire du projet">
      <Tabs defaultValue="all" className="w-full">
        <div className="flex justify-between items-center mb-4">
          <TabsList>
            <TabsTrigger value="all">Tous</TabsTrigger>
            <TabsTrigger value="reports">Rapports</TabsTrigger>
            <TabsTrigger value="specs">Spécifications</TabsTrigger>
            <TabsTrigger value="plans">Plans</TabsTrigger>
          </TabsList>
          <Button disabled className="bg-gray-300 cursor-not-allowed">
            <FilePlus className="mr-2 h-4 w-4" />
            Upload désactivé (à venir)
          </Button>
        </div>

        {['all', 'reports', 'specs', 'plans'].map((tab) => (
          <TabsContent value={tab} className="mt-0" key={tab}>
            <Card>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                  <CardTitle>
                    {tab === "all" ? "Documents du projet" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="sort" className="text-sm">
                      Trier par:
                    </Label>
                    <Select defaultValue="date" onValueChange={(value) => setSortKey(value)}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Trier par" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="date">Date (récent)</SelectItem>
                        <SelectItem value="name">Nom</SelectItem>
                        <SelectItem value="type">Type</SelectItem>
                        <SelectItem value="size">Taille</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {renderDocumentCards(tab)}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </Layout>
  )
}
