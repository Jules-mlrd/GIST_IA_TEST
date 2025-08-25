import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import AffaireDetailClient from './AffaireDetailClient';

async function fetchAffaire(numero_affaire: string) {
  const hdrs = await headers();
  const host = hdrs.get('host');
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
  const res = await fetch(`${protocol}://${host}/api/api_database/affaires/${numero_affaire}`, { cache: 'no-store' });
  return res.json();
}

export default async function AffaireDetailPage({ params }: { params: Promise<{ numero_affaire: string }> }) {
  const { numero_affaire } = await params;
  const data = await fetchAffaire(numero_affaire);
  if (!data.success) return notFound();
  const affaire = data.affaire;
  return <AffaireDetailClient affaire={affaire} />;
} 