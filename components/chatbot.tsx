"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { MessageSquare, Send, X, Loader2, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

type Message = {
  id: string
  content: string
  sender: "user" | "bot"
  timestamp: Date
}

type UploadedFile = {
  file: File;
  status: 'pending' | 'uploading' | 'uploaded' | 'error';
  s3Key?: string; // S3 file reference
  error?: string;
};

function getOrCreateUserId() {
  if (typeof window === 'undefined') return 'default';
  let userId = localStorage.getItem("sncf-chatbot-userId");
  if (!userId) {
    userId = "user-" + Math.random().toString(36).slice(2) + Date.now();
    localStorage.setItem("sncf-chatbot-userId", userId);
  }
  return userId;
}

export function ChatBot() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      content: "Bonjour ! Je suis l'assistant GIST. Comment puis-je vous aider avec votre projet ?",
      sender: "bot",
      timestamp: new Date(),
    },
  ])
  const [inputValue, setInputValue] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [explicabilityMap, setExplicabilityMap] = useState<{ [id: string]: any }>({})
  const [openExplicabilityId, setOpenExplicabilityId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const userId = getOrCreateUserId();
  const [similarPast, setSimilarPast] = useState<any>(null)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Upload a single file to /api/upload
  const uploadFileToS3 = async (file: File, index: number) => {
    setUploadedFiles((prev) => prev.map((uf, i) => i === index ? { ...uf, status: 'uploading' } : uf));
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err);
      }
      const data = await res.json();
      setUploadedFiles((prev) => prev.map((uf, i) => i === index ? { ...uf, status: 'uploaded', s3Key: data.fileName } : uf));
    } catch (error: any) {
      setUploadedFiles((prev) => prev.map((uf, i) => i === index ? { ...uf, status: 'error', error: error?.message || 'Erreur upload' } : uf));
    }
  };

  // Handle file selection and trigger upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const newFiles: UploadedFile[] = Array.from(files).map((file) => ({ file, status: 'pending' }));
      setUploadedFiles((prev) => {
        const startIdx = prev.length;
        const allFiles = [...prev, ...newFiles];
        // Start upload for each new file
        newFiles.forEach((uf, i) => uploadFileToS3(uf.file, startIdx + i));
        return allFiles;
      });
    }
    e.target.value = '' // reset input
  }

  // Remove a file from the list
  const handleRemoveFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  }

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      content: inputValue,
      sender: "user",
      timestamp: new Date(),
    }
    
    setMessages((prev) => [...prev, userMessage])
    const currentMessage = inputValue
    setInputValue("")
    setIsTyping(true)

    try {
      console.log('Envoi du message:', currentMessage)
      
      // Appel à votre API route
      const uploadedS3Keys = uploadedFiles.filter(f => f.status === 'uploaded' && f.s3Key).map(f => f.s3Key);
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: currentMessage,
          userId,
          files: uploadedS3Keys,
        }),
      })

      console.log('Status de la réponse:', response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Erreur API:', errorText)
        throw new Error(`Erreur API: ${response.status}`)
      }

      const data = await response.json()
      console.log('Données reçues:', data)
      
      const botMessage: Message = {
        id: `bot-${Date.now()}`,
        content: data.reply || 'Pas de réponse reçue',
        sender: "bot",
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, botMessage])
      setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : [])
      setExplicabilityMap((prev) => ({ ...prev, [botMessage.id]: data.explicability || null }))
      setSimilarPast(data.similarPast || null)
    } catch (error) {
      console.error('Erreur dans handleSendMessage:', error)
      
      const errorMessage: Message = {
        id: `bot-${Date.now()}`,
        content: `Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
        sender: "bot",
        timestamp: new Date(),
      }
      
      setMessages((prev) => [...prev, errorMessage])
      setSuggestions([])
      setExplicabilityMap((prev) => ({ ...prev, [messages[messages.length-1]?.id || '']: null }))
      setSimilarPast(null)
    } finally {
      setIsTyping(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {isOpen && (
        <Card className="w-80 md:w-96 h-[500px] mb-4 shadow-lg border-sncf-red">
          <CardHeader className="bg-sncf-red text-white py-3 px-4 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Assistant SNCF
                <Badge variant="secondary" className="bg-white/20 text-white text-xs">
                  IA
                </Badge>
              </CardTitle>
              <CardDescription className="text-red-100 text-xs">Posez vos questions sur votre projet</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-full text-white hover:bg-red-700 hover:text-white"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="p-0 flex flex-col h-[calc(500px-56px)]">
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((message, idx) => (
                  <div
                    key={message.id}
                    className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        message.sender === "user" ? "bg-sncf-red text-white" : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {message.sender === "bot" && (
                        <div className="flex items-center gap-2 mb-1">
                          <Avatar className="h-5 w-5">
                            <AvatarFallback className="text-[10px] bg-red-100 text-sncf-red">IA</AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-medium">Assistant SNCF</span>
                        </div>
                      )}
                      <p className="text-sm whitespace-pre-wrap flex items-center gap-2">
                        {message.content}
                        {/* Bouton d'explicabilité à côté de chaque réponse IA */}
                        {message.sender === "bot" && explicabilityMap[message.id] && (
                          <Popover open={openExplicabilityId === message.id} onOpenChange={open => setOpenExplicabilityId(open ? message.id : null)}>
                            <PopoverTrigger asChild>
                              <Button variant="ghost" size="icon" className="ml-1 p-1 h-6 w-6 text-sncf-red" aria-label="Voir le contexte IA">
                                <Info className="h-4 w-4" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 text-xs text-gray-700">
                              <div><b>Fichier courant :</b> {explicabilityMap[message.id].currentFile ? `${explicabilityMap[message.id].currentFile.name} (${explicabilityMap[message.id].currentFile.type})` : 'Aucun'}</div>
                              {explicabilityMap[message.id].multiFilesActive && explicabilityMap[message.id].multiFilesActive.length > 1 && (
                                <div><b>Fichiers actifs :</b> {explicabilityMap[message.id].multiFilesActive.map((f: any) => `${f.name} (${f.type})`).join(', ')}</div>
                              )}
                              {explicabilityMap[message.id].keyEntities && explicabilityMap[message.id].keyEntities.length > 0 && (
                                <div><b>Entités clés :</b> {explicabilityMap[message.id].keyEntities.map((e: any) => `${e.type}: ${e.value}`).join(', ')}</div>
                              )}
                              {explicabilityMap[message.id].userGoals && explicabilityMap[message.id].userGoals.length > 0 && (
                                <div><b>Intentions détectées :</b> {explicabilityMap[message.id].userGoals.join(', ')}</div>
                              )}
                              {explicabilityMap[message.id].contextSummary && (
                                <div><b>Résumé du contexte :</b> {explicabilityMap[message.id].contextSummary}</div>
                              )}
                            </PopoverContent>
                          </Popover>
                        )}
                      </p>
                      <p className="text-xs opacity-70 mt-1 text-right">
                        {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                      {message.sender === "bot" && idx === messages.length - 1 && suggestions.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {suggestions.map((sugg, i) => (
                            <Button
                              key={i}
                              variant="outline"
                              size="sm"
                              className="text-xs border-sncf-red text-sncf-red hover:bg-sncf-red hover:text-white"
                              onClick={() => setInputValue(sugg)}
                            >
                              {sugg}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="max-w-[80%] rounded-lg p-3 bg-gray-100">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">L'assistant réfléchit...</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
            <div className="p-4 border-t">
              {/* File upload UI */}
              <div className="mb-2">
                <input
                  type="file"
                  accept=".pdf,.txt,.docx"
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
                  disabled={isTyping}
                >
                  Ajouter des fichiers (PDF, TXT, DOCX)
                </Button>
                {uploadedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {uploadedFiles.map((uf: UploadedFile, idx: number) => (
                      <div key={idx} className="flex items-center bg-gray-100 rounded px-2 py-1 text-xs">
                        <span className="mr-1">{uf.file.name}</span>
                        {uf.status === 'uploading' && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                        {uf.status === 'uploaded' && <span className="text-green-600 mr-1">✓</span>}
                        {uf.status === 'error' && <span className="text-red-500 mr-1" title={uf.error}>⚠</span>}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-4 w-4 p-0 text-red-500"
                          onClick={() => handleRemoveFile(idx)}
                          aria-label="Supprimer le fichier"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* Suggestion de question similaire */}
              {similarPast && similarPast.question && (
                <div className="mb-2 p-2 bg-yellow-50 border border-yellow-300 rounded text-xs text-yellow-900">
                  <div className="font-semibold mb-1">Question similaire déjà posée :</div>
                  <div><b>Question :</b> {similarPast.question}</div>
                  {similarPast.date && <div><b>Date :</b> {similarPast.date}</div>}
                  {similarPast.answer && <div className="mt-1"><b>Réponse IA :</b> <span className="block bg-gray-100 border border-gray-200 rounded p-1 mt-1">{similarPast.answer}</span></div>}
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="outline" className="text-xs border-sncf-red text-sncf-red hover:bg-sncf-red hover:text-white" onClick={() => setInputValue(similarPast.question)}>
                      Réutiliser cette question
                    </Button>
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  placeholder="Tapez votre question..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="text-sm"
                  disabled={isTyping}
                />
                <Button
                  size="icon"
                  className="bg-sncf-red hover:bg-red-700"
                  onClick={handleSendMessage}
                  disabled={isTyping || !inputValue.trim()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Assistant IA connecté pour répondre à vos questions sur le projet.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className="rounded-full w-14 h-14 bg-sncf-red hover:bg-red-700 shadow-lg"
      >
        <MessageSquare className="h-6 w-6" />
      </Button>
    </div>
  )
}