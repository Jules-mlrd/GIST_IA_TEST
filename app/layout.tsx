import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { GlobalSearch } from "@/components/global-search"
import { ChatBot } from "@/components/chatbot"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "GIST Connect - Assistant IA pour projets",
  description: "Interface intelligente pour la gestion et le support de projets GIST",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body className={inter.className}>
        {children}
        <GlobalSearch />
        <ChatBot />
      </body>
    </html>
  )
}
