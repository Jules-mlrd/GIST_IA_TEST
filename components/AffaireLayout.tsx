import AffaireNav from "@/components/AffaireNav";
import React from "react";

export default function AffaireLayout({ numero_affaire, active, children }: { numero_affaire: string, active: string, children: React.ReactNode }) {
  return (
    <div className="w-full max-w-5xl mx-auto py-8 px-2 md:px-8">
      <AffaireNav numero_affaire={numero_affaire} active={active} />
      {children}
    </div>
  );
} 