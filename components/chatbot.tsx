"use client";
import { useState, useRef, useEffect } from "react";
import ChatToggleButton from "./chatbot/ChatToggleButton";
import ChatBotPanel from "./chatbot/ChatBotPanel";
import { MessageSquare, Send, X, Loader2, FileText, CheckCircle, XCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import SNCFLogo from "../public/logo_sncf.jpeg";

type MessageUser = {
  id: string;
  content: string;
  sender: "user";
  timestamp: Date | string;
};
type MessageBot = {
  id: string;
  content: React.ReactNode;
  sender: "bot";
  timestamp: Date | string;
};
type Message = MessageUser | MessageBot;

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

export function ChatBot({ affaireId, files, loading, affaireName }: Props & { affaireName?: string }) {
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
  const [readFiles, setReadFiles] = useState(true);
  const [contextFiles, setContextFiles] = useState<string[]>([]);

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

  // Handler pour le bouton 'Donner des fichiers en contexte'
  const handleFileContextClick = () => {
    // Pour la démo, toggle le premier fichier du bucket
    if (!files || files.length === 0) return;
    const key = files[0].key;
    setContextFiles(cf => cf.includes(key) ? cf.filter(k => k !== key) : [...cf, key]);
    // À terme, ouvrir un sélecteur de fichiers
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;
    const userMessage: MessageUser = {
      id: `user-${Date.now()}`,
      content: inputValue,
      sender: "user",
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsTyping(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          userId: "default",
          affaireId,
          readFiles,
          contextFiles: contextFiles.length > 0 ? contextFiles : undefined,
        }),
      });
      if (!response.ok) throw new Error('Erreur API');
      const data = await response.json();
      setMessages(prev => [...prev, {
        id: `bot-${Date.now()}`,
        content: typeof data.reply === 'string' ? data.reply : String(data.reply) || 'Pas de réponse reçue',
        sender: "bot",
        timestamp: new Date(),
      } as MessageBot]);
    } catch (error) {
      setMessages(prev => [...prev, {
        id: `bot-${Date.now()}`,
        content: typeof error === 'string' ? error : String(error) || 'Erreur inconnue',
        sender: "bot",
        timestamp: new Date(),
      } as MessageBot]);
    } finally {
      setIsTyping(false);
    }
  };

  // Handler pour l'input utilisateur
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => setInputValue(e.target.value);
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Handler pour le bouton fichiers (exemple : ouvrir la sélection de fichiers)
  const handleFileButtonClick = () => setShowFileIndexing(true);

  // Générer le résumé à afficher (exemple : dernier message bot de type résumé, ou null)
  const summary = messages.find(m => m.sender === "bot" && typeof m.content !== 'string')?.content || null;

  const renderSummary = (summary: string) => (
    <Card className="mb-4 bg-gray-50 border border-blue-100 shadow-none">
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <Info className="h-5 w-5 text-blue-500" />
        <span className="text-blue-700 font-semibold text-sm">Résumé IA</span>
      </CardHeader>
      <CardContent className="text-gray-900 text-sm whitespace-pre-line leading-relaxed" style={{ wordBreak: 'break-word' }}>
        <div dangerouslySetInnerHTML={{ __html: summary.replace(/\n/g, '<br/>').replace(/^- /gm, '<li>• ') }} />
      </CardContent>
    </Card>
  );

  const getUserInitials = () => "U";

  const safeString = (val: unknown) => (typeof val === 'string' ? val : (val ? String(val) : ''));

  const getTimeString = (ts: Date | string) => {
    const d = ts instanceof Date ? ts : new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <>
      <ChatBotPanel
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        affaireId={affaireId}
        affaireName={affaireName}
        files={files}
        loading={loading}
        summary={summary}
        messages={messages}
        inputValue={inputValue}
        isTyping={isTyping}
        onInputChange={handleInputChange}
        onSendMessage={handleSendMessage}
        onInputKeyDown={handleInputKeyDown}
        onFileButtonClick={handleFileButtonClick}
        fileButtonLabel="Joindre des fichiers"
        readFiles={readFiles}
        onToggleReadFiles={() => setReadFiles(v => !v)}
        onFileContextClick={handleFileContextClick}
        contextFiles={contextFiles}
      />
      <ChatToggleButton isOpen={isOpen} onClick={() => setIsOpen(!isOpen)} />
    </>
  );
}