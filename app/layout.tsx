import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { GlobalSearch } from "@/components/global-search"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "GIST Connect - Assistant IA pour projets",
  description: "Interface intelligente pour la gestion et le support de projets GIST",
  generator: "v0.dev",
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
      </body>
    </html>
  )
}
