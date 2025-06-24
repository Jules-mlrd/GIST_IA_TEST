"use client"
import React, { useState, useEffect, useRef } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, FileText, Users, Calendar, HelpCircle, ChevronRight } from "lucide-react"
import { useRouter } from "next/navigation"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

// Dummy fetchers (replace with real API calls or props)
async function fetchDocuments() {
  const res = await fetch("/api/documents")
  const data = await res.json()
  return data.documents || []
}
async function fetchContacts() {
  // Simulate contacts from /contacts/page.tsx
  return [
    { name: "Marie Dubois", type: "team", page: "/contacts" },
    { name: "Jean Martin", type: "team", page: "/contacts" },
    { name: "Philippe Durand", type: "external", page: "/contacts" },
  ]
}
async function fetchMilestones() {
  // Simulate milestones from /timeline/page.tsx
  return [
    { name: "Étude de faisabilité", page: "/timeline" },
    { name: "Validation technique", page: "/timeline" },
  ]
}
async function fetchTasks() {
  // Simulate tasks from /timeline/page.tsx
  return [
    { name: "Analyse des besoins utilisateurs", page: "/timeline" },
    { name: "Développement backend", page: "/timeline" },
  ]
}
async function fetchFaqs() {
  // Simulate FAQ from /submit-question/page.tsx
  return [
    { question: "Comment puis-je suivre l'avancement du projet ?", page: "/submit-question" },
    { question: "Comment télécharger les documents du projet ?", page: "/submit-question" },
  ]
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<any>({})
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Keyboard shortcut Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  // Focus input when opening
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
    else setQuery("")
  }, [open])

  // Fetch and filter results
  useEffect(() => {
    if (!open) return
    const fetchAll = async () => {
      const [docs, contacts, milestones, tasks, faqs] = await Promise.all([
        fetchDocuments(),
        fetchContacts(),
        fetchMilestones(),
        fetchTasks(),
        fetchFaqs(),
      ])
      const q = query.toLowerCase()
      setResults({
        Documents: docs.filter((d: any) => d.name?.toLowerCase().includes(q)),
        Contacts: contacts.filter((c: any) => c.name?.toLowerCase().includes(q)),
        Jalons: milestones.filter((m: any) => m.name?.toLowerCase().includes(q)),
        Tâches: tasks.filter((t: any) => t.name?.toLowerCase().includes(q)),
        FAQ: faqs.filter((f: any) => f.question?.toLowerCase().includes(q)),
      })
    }
    fetchAll()
  }, [query, open])

  const handleNavigate = (page: string) => {
    setOpen(false)
    router.push(page)
  }

  return (
    <>
      {/* Bouton en haut à droite */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className="fixed top-6 right-8 z-50 rounded-full w-12 h-12 bg-sncf-red hover:bg-red-700 shadow-lg"
              onClick={() => setOpen(true)}
              aria-label="Recherche rapide"
            >
              <Search className="h-6 w-6" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Recherche rapide (Ctrl+K)</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg p-0">
          <div className="p-4 border-b flex items-center gap-2">
            <Search className="h-5 w-5 text-gray-400" />
            <Input
              ref={inputRef}
              placeholder="Rechercher un document, contact, jalon, tâche, FAQ..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="border-0 shadow-none focus:ring-0 text-base"
            />
            <kbd className="ml-auto text-xs text-gray-400">Ctrl+K</kbd>
          </div>
          <div className="max-h-96 overflow-y-auto divide-y">
            {Object.entries(results).map(([cat, items]) => {
              const arr = items as any[];
              return arr.length > 0 && (
                <div key={cat} className="p-3">
                  <div className="text-xs font-semibold text-gray-500 mb-2">{cat}</div>
                  <ul>
                    {arr.map((item: any, idx: number) => (
                      <li
                        key={idx}
                        className="flex items-center gap-2 p-2 rounded hover:bg-gray-100 cursor-pointer"
                        onClick={() => handleNavigate(item.page)}
                      >
                        {cat === "Documents" && <FileText className="h-4 w-4 text-sncf-red" />}
                        {cat === "Contacts" && <Users className="h-4 w-4 text-blue-500" />}
                        {cat === "Jalons" && <Calendar className="h-4 w-4 text-green-500" />}
                        {cat === "Tâches" && <Calendar className="h-4 w-4 text-yellow-500" />}
                        {cat === "FAQ" && <HelpCircle className="h-4 w-4 text-purple-500" />}
                        <span className="flex-1 truncate">
                          {cat === "FAQ" ? item.question : item.name}
                        </span>
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
            {Object.values(results).every((arr: any) => (arr as any[]).length === 0) && (
              <div className="p-6 text-center text-gray-400">Aucun résultat</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
} 