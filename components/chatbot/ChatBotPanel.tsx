import React, { useRef, useEffect, useState } from "react";
import { X, Loader2, MoreHorizontal, FileText, Paperclip, ArrowUp, FolderOpen, Settings } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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

// Fonction utilitaire pour nettoyer le HTML du résumé IA
function sanitizeSummaryHtml(html: string): string {
  if (!html) return '';
  // Supprime les balises problématiques
  let clean = html
    .replace(/<\/?(html|body|head|script|style|iframe)[^>]*>/gi, '')
    .replace(/<meta[^>]*>/gi, '')
    .replace(/<link[^>]*>/gi, '')
    .replace(/<\/?title[^>]*>/gi, '');
  // Limite la taille
  if (clean.length > 3000) {
    clean = clean.slice(0, 3000) + '...';
  }
  return clean;
}

const ChatBotPanel: React.FC<Props & {
  readFiles: boolean;
  onToggleReadFiles: () => void;
  onFileButtonClick?: () => void;
  contextFiles: string[];
  onRemoveContextFile?: (key: string) => void;
  suggestions?: string[];
  explicability?: { files?: string[]; prompt?: string };
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
  onFileContextClick,
  suggestions,
  explicabilityBelow,
  onShowPromptModal,
  userPrefs,
  onPrefChange,
}) => {
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Ferme le menu si clic en dehors
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

  // Désactive le scroll du body quand le chatbot est ouvert
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
          {/* Overlay */}
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-30 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          {/* Panneau latéral structuré */}
          <motion.div
            className="fixed right-0 bottom-0 top-0 w-full max-w-md z-50 flex flex-col h-full bg-white rounded-3xl shadow-2xl border border-sncf-red animate-fade-in"
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header sticky */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-sncf-red text-white rounded-t-3xl">
              <div className="font-bold text-lg truncate">
                {affaireName || affaireId}
              </div>
              <div className="flex items-center gap-2">
                {/* Menu déroulant */}
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
                      className="absolute right-0 mt-2 w-56 bg-gray-50 border border-gray-300 rounded-xl shadow-xl z-50 animate-fade-in text-gray-800"
                      onClick={e => e.stopPropagation()}
                    >
                      <button className="w-full text-left px-4 py-2 hover:bg-gray-200 rounded-t-xl flex items-center gap-2" onClick={() => setShowPrefs(true)}>
                        <Settings className="h-4 w-4" /> Préférences
                      </button>
                      <button className="w-full text-left px-4 py-2 hover:bg-gray-200" onClick={() => { setMenuOpen(false); /* TODO: exporter */ }}>Exporter la conversation</button>
                      <button className="w-full text-left px-4 py-2 hover:bg-gray-200 rounded-b-xl" onClick={() => { setMenuOpen(false); /* TODO: copier */ }}>Copier la conversation</button>
                    </div>
                  )}
                  {/* Modale Préférences */}
                  {showPrefs && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
                      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-xs relative">
                        <button className="absolute top-2 right-2 p-2" onClick={() => setShowPrefs(false)}><X className="h-5 w-5" /></button>
                        <h3 className="font-bold text-lg mb-4">Préférences</h3>
                        <div className="flex flex-col gap-4">
                          <label className="flex items-center gap-2">
                            <input type="checkbox" checked={userPrefs?.readFiles} onChange={e => onPrefChange && onPrefChange('readFiles', e.target.checked)} />
                            <span>Activer la lecture des fichiers S3</span>
                          </label>
                          <label className="flex items-center gap-2">
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
            {/* Résumé (optionnel) */}
            {summary && (
              <div className="px-6 py-3 border-b bg-gray-50 text-sm text-gray-700">
                {summary}
              </div>
            )}
            {/* Corps scrollable (historique) */}
            <div
              className="flex-1 min-h-0 overflow-y-auto py-6 px-4 pb-36 bg-white rounded-xl border border-gray-200 shadow-lg scrollbar-thin scrollbar-thumb-sncf-red/60 scrollbar-track-gray-100 border-dashed border-2 border-blue-200"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              <div className="flex flex-col gap-4">
                {messages.map((msg, idx) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className={`flex w-full ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {/* Résumé IA encapsulé dans une bulle spéciale */}
                    {msg.sender === "bot" && typeof msg.content === 'object' && msg.content && (msg.id.startsWith('bot-summary-')) ? (() => {
                      try {
                        // Récupère le HTML du résumé
                        const html = msg.content.props && msg.content.props.dangerouslySetInnerHTML ? msg.content.props.dangerouslySetInnerHTML.__html : '';
                        const safeHtml = sanitizeSummaryHtml(html);
                        return (
                          <div
                            className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-900 max-w-[80%] max-h-[40vh] overflow-y-auto shadow scrollbar-thin scrollbar-thumb-sncf-red/60"
                            style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                            dangerouslySetInnerHTML={{ __html: safeHtml }}
                          />
                        );
                      } catch (e) {
                        return (
                          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800 max-w-[80%]">
                            Erreur lors de l'affichage du résumé IA.
                          </div>
                        );
                      }
                    })() : (
                      <div
                        className={`rounded-2xl px-4 py-2 max-w-[80%] break-words overflow-wrap break-word whitespace-pre-line shadow-sm text-sm transition-colors duration-150
                          ${msg.sender === "user"
                            ? "bg-sncf-red text-white self-end hover:bg-sncf-red/90"
                            : "bg-gray-100 text-gray-800 self-start hover:bg-gray-100/80"}
                        `}
                        style={{ wordBreak: 'break-word', overflowWrap: 'anywhere', cursor: 'pointer' }}
                      >
                        {msg.content}
                      </div>
                    )}
                    {/* Suggestions et explicabilité sous la dernière réponse IA */}
                    {idx === messages.length - 1 && msg.sender === "bot" && (
                      <div className="w-full mt-2 flex flex-col gap-2">
                        {suggestions && suggestions.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {suggestions.map((s, i) => (
                              <button key={i} className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs hover:bg-blue-100 border border-blue-200 transition-colors">
                                {s}
                              </button>
                            ))}
                          </div>
                        )}
                        {explicabilityBelow?.files && explicabilityBelow.files.length > 0 && (
                          <div className="text-xs text-gray-400 mt-1 flex items-center gap-2">
                            <span>Fichiers utilisés :</span>
                            {explicabilityBelow.files.map((f, i) => (
                              <span key={i} className="bg-gray-100 border border-gray-200 rounded px-2 py-0.5 text-gray-700 ml-1">{f}</span>
                            ))}
                            {explicabilityBelow.prompt && onShowPromptModal && (
                              <button className="ml-2 underline text-blue-500 text-xs" onClick={onShowPromptModal} title="Voir le prompt IA">Prompt IA</button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                ))}
                {isTyping && (
                  <div className="flex items-center gap-2 text-sm text-gray-500 animate-pulse">
                    <Loader2 className="h-4 w-4 animate-spin" /> L'assistant réfléchit...
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>
            {/* Footer fixe */}
            <div className="sticky bottom-0 z-10 px-4 py-5 border-t bg-white flex gap-2 items-center rounded-b-3xl">
              <input
                type="text"
                className="flex-1 rounded-full border px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sncf-red"
                placeholder="Posez une question sur l'affaire..."
                value={inputValue}
                onChange={onInputChange}
                onKeyDown={onInputKeyDown}
                disabled={loading || isTyping}
                autoComplete="off"
              />
              {/* Bouton joindre fichier (trombone) */}
              {onFileButtonClick && (
                <button
                  className="ml-1 p-2 rounded-full hover:bg-gray-100 transition-colors"
                  onClick={onFileButtonClick}
                  type="button"
                  title="Joindre un fichier"
                >
                  <Paperclip className="h-5 w-5 text-sncf-red" />
                </button>
              )}
              {/* Bouton donner fichiers en contexte */}
              {onFileContextClick && (
                <button
                  className="ml-1 p-2 rounded-full hover:bg-gray-100 transition-colors"
                  onClick={onFileContextClick}
                  type="button"
                  title="Donner des fichiers en contexte"
                >
                  <FolderOpen className="h-5 w-5 text-blue-500" />
                </button>
              )}
              {/* Toggle lecture fichiers */}
              <button
                className={`ml-1 p-2 rounded-full border ${readFiles ? 'bg-blue-50 border-blue-400' : 'bg-gray-100 border-gray-300'} hover:bg-blue-100 transition-colors`}
                onClick={onToggleReadFiles}
                type="button"
                title="Activer/désactiver la lecture des fichiers"
              >
                <FileText className={`h-5 w-5 ${readFiles ? 'text-blue-600' : 'text-gray-400'}`} />
              </button>
              {/* Bouton envoyer (flèche) */}
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