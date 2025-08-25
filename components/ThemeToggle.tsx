"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "./theme-provider";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200"
      title={theme === "light" ? "Passer en mode sombre" : "Passer en mode clair"}
      aria-label={theme === "light" ? "Passer en mode sombre" : "Passer en mode clair"}
    >
      {theme === "light" ? (
        <Moon className="h-5 w-5 text-gray-700 dark:text-gray-300" />
      ) : (
        <Sun className="h-5 w-5 text-gray-700 dark:text-gray-300" />
      )}
    </button>
  );
} 