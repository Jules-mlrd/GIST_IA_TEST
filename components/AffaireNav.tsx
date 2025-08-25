import Link from "next/link";

const NAV_ITEMS = [
  { label: "Détail", href: (num: string) => `/affaires/${num}`, key: "detail", color: "text-gray-700 hover:bg-gray-100 hover:border-blue-400", active: "border-blue-600 bg-blue-50 text-blue-700" },
  { label: "Dashboard IA", href: (num: string) => `/ai-dashboard?affaire=${num}`, key: "dashboard", color: "text-blue-700 hover:bg-blue-50 hover:border-blue-600", active: "border-blue-600 bg-blue-50 text-blue-700" },
  { label: "Synthèse", href: (num: string) => `/affaires/${num}/synthese`, key: "synthese", color: "text-indigo-700 hover:bg-indigo-50 hover:border-indigo-600", active: "border-indigo-600 bg-indigo-50 text-indigo-700" },
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