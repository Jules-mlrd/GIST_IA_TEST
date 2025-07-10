import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import AffaireFilesClient from './AffaireFilesClient';

async function fetchAffaire(numero_affaire: string) {
  const hdrs = await headers();
  const host = hdrs.get('host');
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
  const res = await fetch(`${protocol}://${host}/api/api_database/affaires/${numero_affaire}`, { cache: 'no-store' });
  return res.json();
}

export default async function AffaireDetailPage({ params }: { params: { numero_affaire: string } }) {
  const { numero_affaire } = params;
  const data = await fetchAffaire(numero_affaire);
  if (!data.success) return notFound();
  const affaire = data.affaire;

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">Détail de l'affaire {affaire.numero_affaire}</h1>
      <div className="bg-white border rounded-lg shadow p-6 mb-8">
        <table className="w-full text-left border-collapse">
          <tbody>
            {Object.entries(affaire).map(([key, value]) => (
              <tr key={key} className="border-b last:border-b-0">
                <th className="py-2 pr-4 font-semibold text-gray-700 capitalize">{key.replace(/_/g, ' ')}</th>
                <td className="py-2 text-gray-900">
                  {key === 's3_folder' && typeof value === 'string' ? (
                    <a href={value} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">{value}</a>
                  ) : (value !== null && value !== undefined && value !== '' ? String(value) : <span className="text-gray-400">-</span>)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <AffaireFilesClient numero_affaire={numero_affaire} />
    </div>
  );
} 