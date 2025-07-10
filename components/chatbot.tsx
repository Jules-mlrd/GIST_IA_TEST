"use client";
import { useState, useRef, useEffect } from "react";
import { MessageSquare, Send, X, Loader2, FileText, CheckCircle, XCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

type Message = {
  id: string;
  content: string;
  sender: "user" | "bot";
  timestamp: Date;
};

type FileMeta = {
  key: string;
  name: string;
  type: string;
  size: number;
  lastModified: string;
  downloadUrl: string;
};

type IndexingStatus = "idle" | "indexing" | "success" | "error";

type Props = {
  affaireId: string;
  files: FileMeta[];
  loading: boolean;
};

export function ChatBot({ affaireId, files, loading }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [indexingStatus, setIndexingStatus] = useState<Record<string, IndexingStatus>>({});
  const [showFileIndexing, setShowFileIndexing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const { toast } = useToast();
  const cardRef = useRef<HTMLDivElement | null>(null);

  // Gestion du clic en dehors pour refermer le ChatBot
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (cardRef.current && !cardRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    // Initial summary is no longer a prop, so we don't set it here.
    // If the user wants to trigger a summary, they will ask for it.
  }, [affaireId]);

  const handleFileSelect = (fileKey: string, checked: boolean) => {
    setSelectedFiles(prev => checked ? [...prev, fileKey] : prev.filter(k => k !== fileKey));
  };

  const handleIndexFiles = async () => {
    for (const fileKey of selectedFiles) {
      setIndexingStatus(prev => ({ ...prev, [fileKey]: 'indexing' }));
      try {
        const res = await fetch(`/api/index-files/${affaireId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ files: [fileKey] }),
        });
        if (!res.ok) throw new Error('Erreur indexation');
        setIndexingStatus(prev => ({ ...prev, [fileKey]: 'success' }));
        toast({ title: 'Indexation réussie', description: `${fileKey} indexé avec succès.`, variant: 'default' });
      } catch {
        setIndexingStatus(prev => ({ ...prev, [fileKey]: 'error' }));
        toast({ title: 'Erreur indexation', description: `Erreur lors de l'indexation de ${fileKey}.`, variant: 'destructive' });
      }
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      content: inputValue,
      sender: "user",
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsTyping(true);

    // Détection de demande de résumé d'affaire
    const resumeRegex = /résum[ée]( moi| de| l'| du| d’)?( l'?affaire| projet| ce projet| cette affaire)?/i;
    const resumeDocRegex = /résum[ée].*(devis|mail|conversation|échange|courriel|facture|rapport|compte[- ]?rendu|note)/i;
    if ((resumeRegex.test(userMessage.content) || resumeDocRegex.test(userMessage.content)) && affaireId) {
      try {
        let data;
        // Cas avancé : résumé d'un type de document (devis, mail, etc.)
        if (resumeDocRegex.test(userMessage.content)) {
          // Recherche sémantique du fichier le plus pertinent
          const searchRes = await fetch(`/api/semantic-search/${affaireId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: userMessage.content }),
          });
          const searchData = await searchRes.json();
          if (searchData.results && searchData.results.length > 0) {
            // Prendre le texte du fichier le plus pertinent
            const bestFile = searchData.results[0];
            // Construire un prompt contextuel
            const prompt = `Contexte de l'affaire :\n${affaireId}\n\nContenu du fichier pertinent (${bestFile.fileKey}) :\n${bestFile.text}\n\nRésume ce document de façon synthétique et structurée pour un chef de projet SNCF.`;
            // Appel à l'API de résumé
            const resp = await fetch(`/api/summary/${affaireId}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ html: prompt }),
            });
            data = await resp.json();
          } else {
            data = { summary: "Aucun fichier pertinent trouvé pour cette demande." };
          }
        } else if (selectedFiles.length > 0) {
          const response = await fetch(`/api/summary/${affaireId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files: selectedFiles }),
          });
          data = await response.json();
        } else {
          const response = await fetch(`/api/summary/${affaireId}`);
          data = await response.json();
        }
        setMessages(prev => [
          ...prev,
          {
            id: `bot-summary-${Date.now()}`,
            content: data.summary || "Aucun résumé généré.",
            sender: "bot",
            timestamp: new Date(),
          },
        ]);
      } catch (error) {
        setMessages(prev => [
          ...prev,
          {
            id: `bot-summary-${Date.now()}`,
            content: `Erreur lors de la génération du résumé : ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
            sender: "bot",
            timestamp: new Date(),
          },
        ]);
      } finally {
        setIsTyping(false);
      }
      return;
    }

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          userId: "default",
          affaireId,
        }),
      });
      if (!response.ok) throw new Error('Erreur API');
      const data = await response.json();
      setMessages(prev => [...prev, {
        id: `bot-${Date.now()}`,
        content: data.reply || 'Pas de réponse reçue',
        sender: "bot",
        timestamp: new Date(),
      }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        id: `bot-${Date.now()}`,
        content: `Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
        sender: "bot",
        timestamp: new Date(),
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {isOpen && (
        <Card ref={cardRef} className="w-96 h-[600px] mb-4 shadow-lg border-sncf-red flex flex-col cursor-pointer" onClick={e => e.stopPropagation()}>
          <CardHeader className="bg-sncf-red text-white flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              <span>Assistant IA GIST</span>
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col p-0">
            {/* Résumé initial */}
            <div className="p-4 pb-2">
              {loading ? (
                <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                  <span>Chargement du résumé…</span>
                </div>
              ) : (
                null
              )}
            </div>
            {/* Fichiers associés (bouton puis liste au clic) */}
            <div className="px-4">
              <div className="bg-gray-50 border border-gray-200 rounded p-3 mb-2">
                <div className="font-semibold mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Fichiers associés
                </div>
                {!showFileIndexing ? (
                  <Button
                    size="sm"
                    className="bg-sncf-red text-white"
                    onClick={() => setShowFileIndexing(true)}
                  >
                    Indexer des fichiers
                  </Button>
                ) : (
                  <>
                    <ul className="space-y-1">
                      {files.map(file => (
                        <li key={file.key} className="flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={selectedFiles.includes(file.key)}
                            onChange={e => handleFileSelect(file.key, e.target.checked)}
                          />
                          <span>{file.name}</span>
                          {indexingStatus[file.key] === 'indexing' && <Badge variant="outline" className="text-blue-600">En cours…</Badge>}
                          {indexingStatus[file.key] === 'success' && <Badge variant="default" className="text-green-600">Indexé <CheckCircle className="inline h-3 w-3" /></Badge>}
                          {indexingStatus[file.key] === 'error' && <Badge variant="destructive" className="text-red-600">Erreur <XCircle className="inline h-3 w-3" /></Badge>}
                        </li>
                      ))}
                    </ul>
                    <div className="flex items-center gap-2 mt-2">
                      <Button
                        size="sm"
                        className="bg-sncf-red text-white"
                        disabled={selectedFiles.length === 0 || Object.values(indexingStatus).includes('indexing')}
                        onClick={handleIndexFiles}
                      >
                        Indexer la sélection
                      </Button>
                      <div className="relative group">
                        <Info className="h-4 w-4 text-gray-500 ml-1 group-hover:text-sncf-red" />
                        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-64 bg-white border border-gray-300 rounded shadow-lg p-2 text-xs text-gray-700 z-50 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity">
                          Les fichiers sélectionnés seront analysés et indexés pour permettre au chatbot de répondre plus rapidement et précisément à vos questions sur leur contenu, sans relire les fichiers à chaque fois.
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="ml-auto"
                        onClick={() => setShowFileIndexing(false)}
                      >
                        Fermer
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
            {/* Fil de discussion (bulle, scrollable, UX améliorée) */}
            <div className="flex-1 flex flex-col px-4 pb-2">
              <div
                className="flex flex-col gap-2 bg-white rounded max-h-[220px] min-h-[80px] overflow-y-auto border border-gray-100 p-2"
                style={{ scrollbarWidth: "thin" }}
                tabIndex={0}
              >
                {messages.map((msg, idx) => (
                  <div
                    key={msg.id}
                    className={`rounded-2xl px-4 py-2 max-w-[80%] break-words whitespace-pre-line shadow-sm ${msg.sender === "user" ? "bg-sncf-red text-white self-end" : "bg-gray-100 text-gray-800 self-start"}`}
                  >
                    <div className="text-sm">{msg.content}</div>
                    <div className="text-xs opacity-70 mt-1 text-right">{msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                  </div>
                ))}
                {isTyping && (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" /> L'assistant réfléchit...
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>
            {/* Zone de saisie */}
            <div className="p-4 border-t flex gap-2 bg-white">
              <Input
                placeholder="Posez une question sur l'affaire ou ses documents…"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
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
          </CardContent>
        </Card>
      )}
      {/* Bouton flottant pour ouvrir le ChatBot */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className="rounded-full w-14 h-14 bg-sncf-red hover:bg-red-700 shadow-lg"
      >
        <MessageSquare className="h-6 w-6" />
      </Button>
    </div>
  );
}