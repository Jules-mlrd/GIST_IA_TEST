import Link from "next/link";

const NAV_ITEMS = [
  { label: "Détail", href: (num: string) => `/affaires/${num}`, key: "detail", color: "text-gray-700 hover:bg-gray-100 hover:border-blue-400", active: "border-blue-600 bg-blue-50 text-blue-700" },
  { label: "Fichiers", href: (num: string) => `#`, key: "fichiers", color: "text-gray-700 hover:bg-gray-100 hover:border-violet-400", active: "border-violet-600 bg-violet-50 text-violet-700" },
  { label: "Dashboard IA", href: (num: string) => `/ai-dashboard?affaire=${num}`, key: "dashboard", color: "text-blue-700 hover:bg-blue-50 hover:border-blue-600", active: "border-blue-600 bg-blue-50 text-blue-700" },
  { label: "Synthèse", href: (num: string) => `/affaires/${num}/synthese`, key: "synthese", color: "text-indigo-700 hover:bg-indigo-50 hover:border-indigo-600", active: "border-indigo-600 bg-indigo-50 text-indigo-700" },
  { label: "Contacts", href: (num: string) => `/contacts?affaire=${num}`, key: "contacts", color: "text-green-700 hover:bg-green-50 hover:border-green-600", active: "border-green-600 bg-green-50 text-green-700" },
  { label: "Risques", href: (num: string) => `/risks?affaire=${num}`, key: "risques", color: "text-orange-700 hover:bg-orange-50 hover:border-orange-600", active: "border-orange-600 bg-orange-50 text-orange-700" },
  { label: "Timeline", href: (num: string) => `/affaires/${num}/timeline`, key: "timeline", color: "text-purple-700 hover:bg-purple-50 hover:border-purple-600", active: "border-purple-600 bg-purple-50 text-purple-700" },
];

export default function AffaireNav({ numero_affaire, active }: { numero_affaire: string, active?: string }) {
  return (
    <nav className="flex gap-2 mb-8 border-b pb-2">
      {NAV_ITEMS.map(item => (
        <Link
          key={item.key}
          href={item.href(numero_affaire)}
          className={`px-4 py-2 rounded-t-lg font-semibold border-b-2 border-transparent transition ${item.color} ${active === item.key ? item.active : ""}`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
} 