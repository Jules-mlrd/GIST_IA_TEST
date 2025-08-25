"use client";

import { useTheme } from "./theme-provider";

export default function ThemeTest() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        Test du Mode Sombre
      </h3>
      <p className="text-gray-700 dark:text-gray-300 mb-4">
        Thème actuel : <span className="font-medium">{theme}</span>
      </p>
      <button
        onClick={toggleTheme}
        className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors"
      >
        Basculer vers le mode {theme === "light" ? "sombre" : "clair"}
      </button>
    </div>
  );
} 