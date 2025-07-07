"use client"

import { useEffect, useState, useRef } from "react"
import { Layout } from "@/components/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileDown, Download, FileText, FilePlus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"

interface S3Document {
  name: string
  key: string
  size: string
  lastModified: string
  type: string
  url: string
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<S3Document[]>([])
  const [sortKey, setSortKey] = useState("date")
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [deleteKey, setDeleteKey] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [previewDoc, setPreviewDoc] = useState<S3Document | null>(null)
  const [previewTxt, setPreviewTxt] = useState<string | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)

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

  useEffect(() => {
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
              <button
                className="font-medium text-gray-900 underline hover:text-sncf-red cursor-pointer bg-transparent border-0 p-0"
                onClick={async () => {
                  setPreviewDoc(doc)
                  setPreviewTxt(null)
                  if (doc.type?.toLowerCase() === 'txt') {
                    setLoadingPreview(true)
                    try {
                      const res = await fetch(doc.url)
                      const txt = await res.text()
                      setPreviewTxt(txt)
                    } catch {
                      setPreviewTxt('Erreur lors du chargement du fichier texte.')
                    } finally {
                      setLoadingPreview(false)
                    }
                  }
                }}
              >
                {doc.name}
              </button>
              <div className="text-sm text-gray-500">
                {doc.lastModified} • {doc.size} • {doc.type}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`https://gism-documents.s3.eu-central-1.amazonaws.com/${doc.key}`}
              download
              className="p-2 hover:bg-gray-100 rounded-md transition-colors"
            >
              <Download className="h-4 w-4 text-gray-600" />
            </a>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 p-0 text-red-500"
              onClick={() => setDeleteKey(doc.key)}
              aria-label="Supprimer le fichier"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))
  }

  const handleRemoveSelectedFile = (idx: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setSelectedFiles((prev) => [...prev, ...Array.from(files)])
    }
    e.target.value = ''
  }

  const handleUpload = async () => {
    setUploading(true)
    setUploadError(null)
    try {
      for (const file of selectedFiles) {
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })
        if (!res.ok) {
          const err = await res.text()
          throw new Error(err)
        }
      }
      setSelectedFiles([])
      await fetchDocuments()
    } catch (err: any) {
      setUploadError(err?.message || 'Erreur upload')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteKey) return
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch('/api/documents', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: deleteKey }),
      })
      if (!res.ok) {
        const err = await res.text()
        throw new Error(err)
      }
      setDeleteKey(null)
      await fetchDocuments()
    } catch (err: any) {
      setDeleteError(err?.message || 'Erreur suppression')
    } finally {
      setDeleting(false)
    }
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
          <div className="flex flex-col items-end">
            <input
              type="file"
              accept=".pdf,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
              multiple
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <Button
              variant="outline"
              size="sm"
              className="mb-2 border-sncf-red text-sncf-red hover:bg-sncf-red hover:text-white"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <FilePlus className="mr-2 h-4 w-4" />
              Ajouter des fichiers
            </Button>
            {selectedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {selectedFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center bg-gray-100 rounded px-2 py-1 text-xs">
                    <span className="mr-1">{file.name}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-4 w-4 p-0 text-red-500"
                      onClick={() => handleRemoveSelectedFile(idx)}
                      aria-label="Supprimer le fichier"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <Button
              onClick={handleUpload}
              disabled={selectedFiles.length === 0 || uploading}
              className="bg-sncf-red text-white hover:bg-red-700"
            >
              {uploading ? 'Upload en cours...' : 'Uploader'}
            </Button>
            {uploadError && <div className="text-xs text-red-600 mt-1">{uploadError}</div>}
          </div>
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
        {/* Aperçu rapide du document */}
        <Dialog open={!!previewDoc} onOpenChange={open => { if (!open) setPreviewDoc(null) }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Aperçu : {previewDoc?.name}</DialogTitle>
            </DialogHeader>
            {previewDoc && (
              <div className="mt-2 min-h-[300px] max-h-[70vh] overflow-auto">
                {(() => {
                  const type = previewDoc.type?.toLowerCase()
                  if (type === 'pdf') {
                    return <iframe src={previewDoc.url} className="w-full min-h-[500px]" style={{height: '70vh'}} />
                  }
                  if (["jpg","jpeg","png","gif","bmp","webp"].includes(type)) {
                    return <img src={previewDoc.url} alt={previewDoc.name} className="max-w-full max-h-[60vh] mx-auto" />
                  }
                  if (type === 'txt') {
                    if (loadingPreview) return <div>Chargement...</div>
                    return <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto max-h-[60vh]">{previewTxt}</pre>
                  }
                  return <div>Aperçu non disponible pour ce type de fichier.</div>
                })()}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setPreviewDoc(null)}>Fermer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={!!deleteKey} onOpenChange={open => { if (!open) setDeleteKey(null) }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Supprimer ce fichier ?</DialogTitle>
            </DialogHeader>
            <div>Êtes-vous sûr de vouloir supprimer ce fichier ? Cette action est irréversible.</div>
            {deleteError && <div className="text-xs text-red-600 mt-2">{deleteError}</div>}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteKey(null)} disabled={deleting}>Annuler</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Suppression...' : 'Supprimer'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Tabs>
    </Layout>
  )
}
