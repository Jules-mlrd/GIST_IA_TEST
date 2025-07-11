import { MessageSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import React from "react";

type Props = {
  isOpen: boolean;
  onClick: () => void;
};

const ChatToggleButton: React.FC<Props> = ({ isOpen, onClick }) => (
  <AnimatePresence>
    {!isOpen && (
      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.3 }}
        className="fixed right-6 bottom-6 z-50 rounded-full w-14 h-14 bg-sncf-red hover:bg-red-700 shadow-xl flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-sncf-red"
        aria-label="Ouvrir le ChatBot IA"
        onClick={onClick}
      >
        <MessageSquare className="h-6 w-6 text-white" />
      </motion.button>
    )}
  </AnimatePresence>
);

export default ChatToggleButton; 