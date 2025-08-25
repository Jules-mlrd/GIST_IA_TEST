import React, { useRef, useEffect, useState } from "react";
import { X, Loader2, MoreHorizontal, FileText, Paperclip, ArrowUp, FolderOpen, Settings } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { marked } from "marked";
import DOMPurify from 'dompurify';

type Message = {
  id: string;
  content: React.ReactNode;
  sender: "user" | "bot";
  timestamp: Date | string;
};

type FileMeta = {
  key: string;
  name: string;
  type: string;
  size: number;
  lastModified: string;
  downloadUrl: string;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  affaireId: string;
  affaireName?: string;
  files: FileMeta[];
  loading: boolean;
  summary?: React.ReactNode;
  messages: Message[];
  inputValue: string;
  isTyping: boolean;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSendMessage: () => void;
  onInputKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onFileButtonClick?: () => void;
  fileButtonLabel?: string;
};

function sanitizeSummaryHtml(html: string): string {
  if (!html) return '';
  let clean = html
    .replace(/<\/?(html|body|head|script|style|iframe)[^>]*>/gi, '')
    .replace(/<meta[^>]*>/gi, '')
    .replace(/<link[^>]*>/gi, '')
    .replace(/<\/?title[^>]*>/gi, '');
  if (clean.length > 3000) {
    clean = clean.slice(0, 3000) + '...';
  }
  return clean;
}

function markdownToCleanHtml(md: string): string {
  md = md.replace(/^#+ .+$/gm, "");
  md = md.replace(/\*\*(.*?)\*\*/g, "$1");
  md = md.replace(/\*(.*?)\*/g, "$1");
  md = md.replace(/\[(.*?)\]\((.*?)\)/g, "$1");
  md = md.replace(/!\[.*?\]\(.*?\)/g, "");
  md = md.replace(/^> ?/gm, "");
  md = md.replace(/`([^`]+)`/g, "$1");
  md = md.replace(/^---+$/gm, "");
  md = md.replace(/\n{3,}/g, "\n\n");
  let html = marked.parse(md) as string;
  html = DOMPurify.sanitize(html, { ALLOWED_TAGS: ["ul", "ol", "li", "p", "br", "strong", "em", "span"], ALLOWED_ATTR: [] });
  return html;
}

function formatFileSize(bytes: number) {
  if (bytes === 0) return '0 KB';
  const k = 1024;
  const sizes = ['KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

const ChatBotPanel: React.FC<Props & {
  readFiles: boolean;
  onToggleReadFiles: () => void;
  onFileButtonClick?: () => void;
  contextFiles: string[];
  onRemoveContextFile?: (key: string) => void;
  suggestions?: string[];
  explicability?: { files?: string[]; prompt?: string } | null;
  onShowPromptModal?: () => void;
  userPrefs?: { readFiles: boolean; showPromptByDefault: boolean };
  onPrefChange?: (key: string, value: boolean) => void;
}> = ({
  isOpen,
  onClose,
  affaireId,
  affaireName,
  files,
  loading,
  summary,
  messages,
  inputValue,
  isTyping,
  onInputChange,
  onSendMessage,
  onInputKeyDown,
  onFileButtonClick,
  fileButtonLabel = "Joindre des fichiers",
  readFiles,
  onToggleReadFiles,
  contextFiles,
  onRemoveContextFile,
  suggestions,
  explicability,
  onShowPromptModal,
  userPrefs,
  onPrefChange,
}) => {
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Ajout : scroll automatique à l'ouverture du chatbot
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
      }, 0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const original = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = original; };
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-30 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed right-0 bottom-0 top-0 w-full max-w-md z-50 flex flex-col h-full bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-sncf-red dark:border-gray-600 animate-fade-in"
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-sncf-red text-white rounded-t-3xl">
              <div className="font-bold text-lg truncate">
                {affaireName || affaireId}
              </div>
              <div className="flex items-center gap-2">
                <div className="relative" ref={menuRef}>
                  <button
                    className="p-2 rounded-full hover:bg-white/20 focus:outline-none"
                    onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
                    aria-label="Ouvrir le menu du chat"
                  >
                    <MoreHorizontal className="h-5 w-5" />
                  </button>
                  {menuOpen && (
                    <div
                      className="absolute right-0 mt-2 w-56 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl shadow-xl z-50 animate-fade-in text-gray-800 dark:text-gray-200"
                      onClick={e => e.stopPropagation()}
                    >
                      <button className="w-full text-left px-4 py-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-t-xl flex items-center gap-2" onClick={() => setShowPrefs(true)}>
                        <Settings className="h-4 w-4" /> Préférences
                      </button>
                      <button className="w-full text-left px-4 py-2 hover:bg-gray-200 dark:hover:bg-gray-600" onClick={() => { setMenuOpen(false); /* TODO: exporter */ }}>Exporter la conversation</button>
                      <button className="w-full text-left px-4 py-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-b-xl" onClick={() => { setMenuOpen(false); /* TODO: copier */ }}>Copier la conversation</button>
                    </div>
                  )}
                  {showPrefs && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
                      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 w-full max-w-xs relative">
                        <button className="absolute top-2 right-2 p-2" onClick={() => setShowPrefs(false)}><X className="h-5 w-5" /></button>
                        <h3 className="font-bold text-lg mb-4 text-gray-900 dark:text-white">Préférences</h3>
                        <div className="flex flex-col gap-4">
                          <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                            <input type="checkbox" checked={userPrefs?.readFiles} onChange={e => onPrefChange && onPrefChange('readFiles', e.target.checked)} />
                            <span>Activer la lecture des fichiers S3</span>
                          </label>
                          <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                            <input type="checkbox" checked={userPrefs?.showPromptByDefault} onChange={e => onPrefChange && onPrefChange('showPromptByDefault', e.target.checked)} />
                            <span>Afficher le prompt IA par défaut</span>
                          </label>
                        </div>
                        <div className="flex justify-end mt-6">
                          <button className="px-4 py-2 rounded bg-sncf-red text-white font-bold hover:bg-red-700" onClick={() => setShowPrefs(false)}>Fermer</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <button onClick={onClose} className="p-2 rounded-full hover:bg-white/20">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            {summary && (
              <div className="px-6 py-3 border-b bg-gray-50 dark:bg-gray-700 text-sm text-gray-700 dark:text-gray-300">
                {summary}
              </div>
            )}
            <div
              className="flex-1 min-h-0 overflow-y-auto py-6 px-4 pb-36 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-600 shadow-lg scrollbar-thin scrollbar-thumb-sncf-red/60 scrollbar-track-gray-100 dark:scrollbar-track-gray-700 border-dashed border-2 border-blue-200 dark:border-blue-700"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {/* Indicateur des fichiers joints */}
              {contextFiles.length > 0 && (
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Paperclip className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      {contextFiles.length} fichier{contextFiles.length > 1 ? 's' : ''} joint{contextFiles.length > 1 ? 's' : ''} à la conversation
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {contextFiles.map(key => {
                      const file = files.find(f => f.key === key);
                      return (
                        <div key={key} className="flex items-center gap-1 bg-white dark:bg-gray-700 border border-blue-300 dark:border-blue-600 rounded-full px-2 py-1 text-xs">
                          <FileText className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                          <span className="text-blue-700 dark:text-blue-300 truncate max-w-32">{file ? file.name : key}</span>
                          {onRemoveContextFile && (
                            <button 
                              onClick={() => onRemoveContextFile(key)}
                              className="ml-1 p-0.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-full"
                            >
                              <X className="h-3 w-3 text-red-500" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {/* Message d'aide si aucun fichier joint */}
              {contextFiles.length === 0 && messages.length === 0 && (
                <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                    <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Conseil</span>
                  </div>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    Pour analyser un fichier spécifique, cliquez sur "Joindre des fichiers" en haut à droite, 
                    sélectionnez vos documents, puis posez votre question. L'IA analysera uniquement les fichiers sélectionnés.
                  </p>
                </div>
              )}
              
              <div className="flex flex-col gap-4">
                {messages.map((msg, idx) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className={`flex w-full ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.sender === "bot" ? (
                      <div
                        className="rounded-2xl px-4 py-2 max-w-[80%] bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 self-start shadow-sm text-sm leading-relaxed chatbot-ia-bubble"
                        style={{ wordBreak: 'break-word', overflowWrap: 'anywhere', fontFamily: 'Inter, Arial, sans-serif', margin: '0.5rem 0' }}
                        dangerouslySetInnerHTML={{ __html: markdownToCleanHtml(typeof msg.content === 'string' ? msg.content : String(msg.content)) }}
                      />
                    ) : (
                      <div
                        className={`rounded-2xl px-4 py-2 max-w-[80%] break-words overflow-wrap break-word whitespace-pre-line shadow-sm text-sm transition-colors duration-150
                          bg-sncf-red text-white self-end hover:bg-sncf-red/90`}
                        style={{ wordBreak: 'break-word', overflowWrap: 'anywhere', cursor: 'pointer' }}
                      >
                        {msg.content}
                      </div>
                    )}
                    {idx === messages.length - 1 && msg.sender === "bot" && (
                      <div className="w-full mt-2 flex flex-col gap-2">
                        {suggestions && suggestions.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {suggestions.map((s, i) => (
                              <button key={i} className="px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-700 transition-colors">
                                {s}
                              </button>
                            ))}
                          </div>
                        )}
                        {explicability?.files && explicability.files.length > 0 && (
                          <div className="text-xs text-gray-400 dark:text-gray-500 mt-1 flex items-center gap-2">
                            <span>Fichiers utilisés :</span>
                            {explicability.files.map((f: string, i: number) => (
                              <span key={i} className="bg-gray-100 dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded px-2 py-0.5 text-gray-700 dark:text-gray-300 ml-1">{f}</span>
                            ))}
                            {explicability.prompt && onShowPromptModal && (
                              <button className="ml-2 underline text-blue-500 dark:text-blue-400 text-xs" onClick={onShowPromptModal} title="Voir le prompt IA">Prompt IA</button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                ))}
                {isTyping && (
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 animate-pulse">
                    <Loader2 className="h-4 w-4 animate-spin" /> L'assistant réfléchit...
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>
            <div className="sticky bottom-0 z-10 px-4 py-5 border-t bg-white dark:bg-gray-800 dark:border-gray-700 flex gap-2 items-center rounded-b-3xl">
              <input
                type="text"
                className="flex-1 rounded-full border px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sncf-red bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400"
                placeholder="Posez une question sur l'affaire..."
                value={inputValue}
                onChange={onInputChange}
                onKeyDown={onInputKeyDown}
                disabled={loading || isTyping}
                autoComplete="off"
              />
              {onFileButtonClick && (
                <button
                  className={`ml-1 p-2 rounded-full transition-all duration-200 relative group ${
                    contextFiles.length > 0 
                      ? 'bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-300 dark:border-blue-600 hover:bg-blue-200 dark:hover:bg-blue-900/50' 
                      : 'bg-gray-100 dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                  onClick={onFileButtonClick}
                  type="button"
                  title={`Joindre un fichier${contextFiles.length > 0 ? ` (${contextFiles.length} fichier${contextFiles.length > 1 ? 's' : ''} joint${contextFiles.length > 1 ? 's' : ''})` : ''}`}
                >
                  <Paperclip className={`h-5 w-5 transition-colors ${
                    contextFiles.length > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400 group-hover:text-sncf-red'
                  }`} />
                  {contextFiles.length > 0 && (
                    <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-medium shadow-lg">
                      {contextFiles.length}
                    </span>
                  )}
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 dark:bg-gray-700 text-white dark:text-gray-200 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                    {contextFiles.length > 0 
                      ? `${contextFiles.length} fichier${contextFiles.length > 1 ? 's' : ''} joint${contextFiles.length > 1 ? 's' : ''}`
                      : 'Joindre des fichiers'
                    }
                  </div>
                </button>
              )}
              <button
                className={`ml-1 p-2 rounded-full border ${readFiles ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-400 dark:border-blue-600' : 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600'} hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors`}
                onClick={onToggleReadFiles}
                type="button"
                title="Activer/désactiver la lecture des fichiers"
              >
                <FileText className={`h-5 w-5 ${readFiles ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`} />
              </button>
              <button
                className="ml-1 p-2 rounded-full bg-sncf-red hover:bg-red-700 disabled:opacity-60 transition-colors"
                onClick={onSendMessage}
                disabled={loading || isTyping || !inputValue.trim()}
                type="button"
                title="Envoyer"
              >
                <ArrowUp className="h-5 w-5 text-white" />
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ChatBotPanel; 