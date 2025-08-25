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
type UserPrefs = {
  readFiles: boolean;
  showPromptByDefault: boolean;
};
const DEFAULT_USER_PREFS: UserPrefs = {
  readFiles: true,
  showPromptByDefault: false,
};

export function ChatBot({ affaireId, files, loading, affaireName }: Props & { affaireName?: string }) {
  console.log('ChatBot - AffaireId:', affaireId);
  console.log('ChatBot - Files reçus:', files);
  console.log('ChatBot - Loading:', loading);
  
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
  const [userPrefs, setUserPrefs] = useState<UserPrefs>(() => {
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

  useEffect(() => {
    setReadFiles(userPrefs.readFiles);
  }, [userPrefs.readFiles]);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('chatbotUserPrefs', JSON.stringify(userPrefs));
    }
  }, [userPrefs]);
  const handlePrefChange = (key: string, value: boolean) => {
    setUserPrefs((prefs: UserPrefs) => ({ ...prefs, [key]: value }));
  };

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

  // Chargement de l'historique du chat depuis l'API Redis - DÉSACTIVÉ pour démarrer avec un chat vide
  // useEffect(() => {
  //   if (!affaireId) return;
  //   fetch(`/api/chat?affaireId=${encodeURIComponent(affaireId)}`)
  //     .then(res => res.json())
  //     .then(data => {
  //       console.log('Messages reçus de l\'API:', data);
  //       if (Array.isArray(data.history) && data.history.length > 0) {
  //         console.log('Historique valide, mise à jour des messages');
  //         setMessages(data.history);
  //       } else {
  //         console.log('Historique vide ou invalide, garder les messages locaux');
  //       }
  //     })
  //     .catch(error => {
  //       console.error('Erreur lors du chargement de l\'historique:', error);
  //     });
  // }, [affaireId]);

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

  const handleFileContextClick = () => {
    if (!files || files.length === 0) return;
    const key = files[0].key;
    setContextFiles(cf => cf.includes(key) ? cf.filter(k => k !== key) : [...cf, key]);
  };

  const handleFileButtonClick = () => {
    setPendingContextFiles(contextFiles);
    setShowFileModal(true);
  };
  const handleS3FileToggle = (key: string) => {
    setPendingContextFiles(cf => cf.includes(key) ? cf.filter(k => k !== key) : [...cf, key]);
  };
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
  const handleRemoveContextFile = (key: string) => setContextFiles(cf => cf.filter(k => k !== key));
  const handleRemovePendingContextFile = (key: string) => setPendingContextFiles(cf => cf.filter(k => k !== key));
  const handleCloseFileModal = () => setShowFileModal(false);
  const handleValidateFileModal = () => {
    setContextFiles(pendingContextFiles);
    setShowFileModal(false);
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
    const currentInputValue = inputValue;
    setInputValue("");
    setIsTyping(true);

    try {
      console.log('Envoi du message:', currentInputValue);
      console.log('Fichiers de contexte:', contextFiles);
      console.log('Fichiers sélectionnés:', selectedFiles);
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          affaireId,
          message: currentInputValue,
          contextFiles: contextFiles, // Ajouter les fichiers sélectionnés
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.reply || 'Erreur API');
      }
      
      const data = await response.json();
      console.log('Réponse de l\'API:', data);
      
      // Ajouter la réponse du bot directement
      if (data.reply) {
        const botMessage: MessageBot = {
          id: `bot-${Date.now()}`,
          content: data.reply,
          sender: "bot",
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, botMessage]);
      }
      
      setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
      setExplicability(data.explicability || null);
    } catch (error) {
      console.error('Erreur lors de l\'envoi du message:', error);
      const errorMessage: MessageBot = {
        id: `bot-error-${Date.now()}`,
        content: typeof error === 'string' ? error : String(error) || 'Erreur inconnue',
        sender: "bot",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
      setSuggestions([]);
      setExplicability(null);
    } finally {
      setIsTyping(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => setInputValue(e.target.value);
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

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

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 KB';
    const k = 1024;
    const sizes = ['KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
          setReadFiles((v: boolean) => {
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
      {showFileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-2xl max-h-[85vh] overflow-hidden relative flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200 flex-shrink-0">
              <div>
                <h3 className="font-bold text-xl text-gray-900">Joindre des fichiers</h3>
                <p className="text-sm text-gray-500 mt-1">Sélectionnez les fichiers à utiliser dans la conversation</p>
              </div>
              <button 
                className="p-2 hover:bg-gray-100 rounded-full transition-colors" 
                onClick={handleCloseFileModal}
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            
            <div className="overflow-y-auto flex-1 pr-2 min-h-0">
              {/* Fichiers actuellement joints */}
              {contextFiles.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <h4 className="font-semibold text-gray-900">Fichiers actuellement joints ({contextFiles.length})</h4>
                  </div>
                  <div className="space-y-2">
                    {contextFiles.map(key => {
                      const file = files.find(f => f.key === key);
                      return (
                        <div key={key} className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                              <FileText className="h-4 w-4 text-green-600" />
                            </div>
                            <div>
                              <div className="font-medium text-gray-900 text-sm">{file ? file.name : key}</div>
                              <div className="text-xs text-gray-500">
                                {file ? `${file.type} • ${formatFileSize(file.size)}` : 'Fichier'}
                              </div>
                            </div>
                          </div>
                          <button 
                            className="p-1 hover:bg-red-100 rounded-full transition-colors" 
                            onClick={() => handleRemoveContextFile(key)}
                            title="Retirer ce fichier"
                          >
                            <X className="h-4 w-4 text-red-500" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {/* Fichiers disponibles depuis S3 */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <h4 className="font-semibold text-gray-900">Fichiers disponibles depuis S3</h4>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-2 border border-gray-200 rounded-lg p-3">
                  {files.filter(f => !contextFiles.includes(f.key)).map(f => (
                    <label key={f.key} className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors">
                      <input 
                        type="checkbox" 
                        checked={pendingContextFiles.includes(f.key)} 
                        onChange={() => handleS3FileToggle(f.key)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <FileText className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 text-sm truncate">{f.name}</div>
                        <div className="text-xs text-gray-500">{f.type} • {formatFileSize(f.size)}</div>
                      </div>
                    </label>
                  ))}
                  {files.filter(f => !contextFiles.includes(f.key)).length === 0 && (
                    <div className="text-center py-8 text-gray-400">
                      <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <div className="text-sm">Aucun nouveau fichier disponible</div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Upload depuis l'ordinateur */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <h4 className="font-semibold text-gray-900">Depuis mon ordinateur</h4>
                </div>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-purple-400 transition-colors">
                  <input 
                    type="file" 
                    multiple 
                    onChange={handleLocalFileUpload} 
                    disabled={uploading}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                      <Paperclip className="h-6 w-6 text-purple-600" />
                    </div>
                    <div className="text-sm text-gray-600">
                      {uploading ? 'Upload en cours...' : 'Cliquez pour sélectionner des fichiers'}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">PDF, TXT, CSV, XLSX acceptés</div>
                  </label>
                </div>
              </div>
            </div>
            
            {/* Footer */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 mt-6 flex-shrink-0">
              <button 
                className="px-6 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-colors" 
                onClick={handleCloseFileModal}
              >
                Annuler
              </button>
              <button
                className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                  pendingContextFiles.length > 0 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
                onClick={handleValidateFileModal}
                disabled={pendingContextFiles.length === 0}
              >
                Ajouter {pendingContextFiles.length > 0 ? `(${pendingContextFiles.length})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}
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