"use client";
import { useState, useRef, useEffect } from "react";
import ChatToggleButton from "./chatbot/ChatToggleButton";
import ChatBotPanel from "./chatbot/ChatBotPanel";
import { MessageSquare, Send, X, Loader2, FileText, CheckCircle, XCircle, Info, Paperclip } from "lucide-react";
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

// Préférences utilisateur par défaut
const DEFAULT_USER_PREFS = {
  readFiles: true,
  showPromptByDefault: false,
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
  const [userPrefs, setUserPrefs] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        return { ...DEFAULT_USER_PREFS, ...JSON.parse(localStorage.getItem('chatbotUserPrefs') || '{}') };
      } catch {
        return DEFAULT_USER_PREFS;
      }
    }
    return DEFAULT_USER_PREFS;
  });
  const [readFiles, setReadFiles] = useState(userPrefs.readFiles);
  const [contextFiles, setContextFiles] = useState<string[]>([]);
  const [pendingContextFiles, setPendingContextFiles] = useState<string[]>([]);
  const [showFileModal, setShowFileModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [explicability, setExplicability] = useState<{ files?: string[]; prompt?: string } | null>(null);
  const [showPromptModal, setShowPromptModal] = useState(false);

  // Synchronise readFiles avec userPrefs
  useEffect(() => {
    setReadFiles(userPrefs.readFiles);
  }, [userPrefs.readFiles]);
  // Sauvegarde userPrefs dans localStorage à chaque modif
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('chatbotUserPrefs', JSON.stringify(userPrefs));
    }
  }, [userPrefs]);
  // Handler pour changer une préférence
  const handlePrefChange = (key: string, value: boolean) => {
    setUserPrefs(prefs => ({ ...prefs, [key]: value }));
  };

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

  // Handler pour le bouton "Joindre des fichiers"
  const handleFileButtonClick = () => {
    setPendingContextFiles(contextFiles);
    setShowFileModal(true);
  };
  // Handler pour la sélection S3
  const handleS3FileToggle = (key: string) => {
    setPendingContextFiles(cf => cf.includes(key) ? cf.filter(k => k !== key) : [...cf, key]);
  };
  // Handler pour l'upload local
  const handleLocalFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const filesToUpload = e.target.files;
    if (!filesToUpload) return;
    setUploading(true);
    let newKeys: string[] = [];
    for (const file of Array.from(filesToUpload)) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('affaireId', affaireId);
      const res = await fetch(`/api/files/${affaireId}/upload`, { method: 'POST', body: formData });
      if (res.ok) {
        const data = await res.json();
        if (data.key) newKeys.push(data.key);
      }
    }
    setPendingContextFiles(cf => [...cf, ...newKeys]);
    setUploading(false);
  };
  // Handler pour retirer un fichier sélectionné
  const handleRemoveContextFile = (key: string) => setContextFiles(cf => cf.filter(k => k !== key));
  const handleRemovePendingContextFile = (key: string) => setPendingContextFiles(cf => cf.filter(k => k !== key));
  // Handler pour fermer la modale
  const handleCloseFileModal = () => setShowFileModal(false);
  // Handler pour valider la sélection
  const handleValidateFileModal = () => {
    setContextFiles(pendingContextFiles);
    setShowFileModal(false);
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;
    const userMessage: MessageUser = {
      id: `user-${messages.length}`,
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
        id: `bot-${prev.length+1}`,
        content: typeof data.reply === 'string' ? data.reply : String(data.reply) || 'Pas de réponse reçue',
        sender: "bot",
        timestamp: new Date(),
      } as MessageBot]);
      setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
      setExplicability(data.explicability || null);
    } catch (error) {
      setMessages(prev => [...prev, {
        id: `bot-${prev.length+1}`,
        content: typeof error === 'string' ? error : String(error) || 'Erreur inconnue',
        sender: "bot",
        timestamp: new Date(),
      } as MessageBot]);
      setSuggestions([]);
      setExplicability(null);
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
        contextFiles={contextFiles}
        onRemoveContextFile={handleRemoveContextFile}
        readFiles={readFiles}
        onToggleReadFiles={() => {
          setReadFiles(v => {
            handlePrefChange('readFiles', !v);
            return !v;
          });
        }}
        suggestions={suggestions}
        explicability={explicability}
        onShowPromptModal={() => setShowPromptModal(true)}
        userPrefs={userPrefs}
        onPrefChange={handlePrefChange}
      />
      <ChatToggleButton isOpen={isOpen} onClick={() => setIsOpen(!isOpen)} />
      {/* Modale de sélection/ajout de fichiers */}
      {showFileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md relative">
            <button className="absolute top-2 right-2 p-2" onClick={handleCloseFileModal}><X className="h-5 w-5" /></button>
            <h3 className="font-bold text-lg mb-4">Joindre des fichiers</h3>
            <div className="mb-4">
              <div className="font-semibold mb-2">Depuis le bucket S3 :</div>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {files.map(f => (
                  <label key={f.key} className="flex items-center gap-2 cursor-pointer text-sm">
                    <input type="checkbox" checked={pendingContextFiles.includes(f.key)} onChange={() => handleS3FileToggle(f.key)} />
                    <span>{f.name}</span>
                    {pendingContextFiles.includes(f.key) && (
                      <button className="ml-1" onClick={() => handleRemovePendingContextFile(f.key)}><X className="h-3 w-3" /></button>
                    )}
                  </label>
                ))}
                {files.length === 0 && <div className="text-gray-400 text-xs">Aucun fichier disponible</div>}
              </div>
            </div>
            <div className="mb-4">
              <div className="font-semibold mb-2">Depuis mon ordinateur :</div>
              <input type="file" multiple onChange={handleLocalFileUpload} disabled={uploading} />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200" onClick={handleCloseFileModal}>Fermer</button>
              <button
                className="px-4 py-2 rounded bg-sncf-red text-white font-bold hover:bg-red-700 disabled:opacity-60"
                onClick={handleValidateFileModal}
                disabled={pendingContextFiles.length === 0}
              >Valider</button>
            </div>
          </div>
        </div>
      )}
      {/* Affichage des fichiers sélectionnés sous la barre de saisie (pills) */}
      {contextFiles.length > 0 && (
        <div className="fixed right-6 bottom-28 z-50 flex flex-wrap gap-2 max-w-md">
          {contextFiles.map(key => {
            const file = files.find(f => f.key === key);
            return (
              <span key={key} className="flex items-center bg-blue-50 border border-blue-200 text-blue-800 rounded-full px-3 py-1 text-xs">
                {file ? file.name : key}
                <button className="ml-1" onClick={() => handleRemoveContextFile(key)}><X className="h-3 w-3" /></button>
              </span>
            );
          })}
        </div>
      )}
      {/* Modale pour afficher le prompt complet (explicabilité) */}
      {showPromptModal && explicability?.prompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-2xl relative">
            <button className="absolute top-2 right-2 p-2" onClick={() => setShowPromptModal(false)}><X className="h-5 w-5" /></button>
            <h3 className="font-bold text-lg mb-4">Prompt complet envoyé à l'IA</h3>
            <pre className="text-xs bg-gray-50 p-4 rounded max-h-[60vh] overflow-y-auto whitespace-pre-wrap">{explicability.prompt}</pre>
          </div>
        </div>
      )}
    </>
  );
}