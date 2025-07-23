import Link from 'next/link';
import { headers } from 'next/headers';
import AffaireNav from "@/components/AffaireNav";

function displayValue(val: any) {
  if (val === null || val === undefined || val === '' || val === 'nr' || val === 'Empty' || val === '-') return 'Non renseigné';
  return val;
}

async function fetchAffaire(numero_affaire: string) {
  const hdrs = await headers();
  const host = hdrs.get('host');
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
  const url = `${protocol}://${host}/api/api_database/affaires/${numero_affaire}`;
  const res = await fetch(url, { cache: 'no-store' });
  return res.json();
}

export default async function NoteTravauxPage({ params }: { params: { numero_affaire: string } }) {
  const { numero_affaire } = params;
  const data = await fetchAffaire(numero_affaire);
  const affaire = data.success ? data.affaire : null;

  return (
    <div className="py-8 px-2 text-base">
      <AffaireNav numero_affaire={numero_affaire} active="notes-travaux" />
      <div className="w-full max-w-full mx-auto mt-4">
        <div className="bg-black rounded-t-lg px-6 py-5">
          <h2 className="text-lg font-bold text-white">Description</h2>
        </div>
        <div className="bg-white border rounded-b-lg shadow p-8 text-base">
          {affaire ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-2 text-gray-900 mb-8">
                {/* Colonne 1 */}
                <div className="space-y-2">
                  <div><span className="font-semibold">Titre :</span> {displayValue(affaire.titre)}</div>
                  <div><span className="font-semibold">N° affaire :</span> {displayValue(affaire.numero_affaire)}</div>
                  <div><span className="font-semibold">Reference client :</span> {displayValue(affaire.reference_client)}</div>
                  <div><span className="font-semibold">Sites PASTELI :</span> {displayValue(affaire.site)}</div>
                  <div><span className="font-semibold">Etat :</span> {displayValue(affaire.etat)}</div>
                  <div><span className="font-semibold">Date de diffusion :</span> {affaire.date_diffusion ? new Date(affaire.date_diffusion).toLocaleDateString() : 'Non renseigné'}</div>
                  <div><span className="font-semibold">Crée par :</span> {displayValue(affaire.cree_par)}</div>
                  <div><span className="font-semibold">Risque environnemental :</span> {displayValue(affaire.risque_environnemental)}</div>
                  <div><span className="font-semibold">Mesures environnementales :</span> {displayValue(affaire.mesure_env)}</div>
                  <div><span className="font-semibold">Commentaires environnementales :</span> {displayValue(affaire.commentaires_env)}</div>
                </div>
                {/* Colonne 2 */}
                <div className="space-y-2">
                  <div><span className="font-semibold">Type de note :</span> {displayValue(affaire.type_note)}</div>
                  <div><span className="font-semibold">Portefeuille Projet :</span> {displayValue(affaire.portefeuille_projet)}</div>
                  <div><span className="font-semibold">Programme :</span> {displayValue(affaire.programme)}</div>
                  <div><span className="font-semibold">Priorité/Complexité :</span> {displayValue(affaire.priorite)} / {displayValue(affaire.complexite)}</div>
                  <div><span className="font-semibold">Référent UP ou RA :</span> {displayValue(affaire.referent)}</div>
                  <div><span className="font-semibold">Mission :</span> {displayValue(affaire.type_mission)}</div>
                  <div><span className="font-semibold">Date engagement fin de travaux ESTI :</span> {affaire.date_engagement_fdt_esti ? new Date(affaire.date_engagement_fdt_esti).toLocaleDateString() : 'Non renseigné'}</div>
                  <div><span className="font-semibold">Date d'indication de fin de travaux :</span> {affaire.date_indication_fdt ? new Date(affaire.date_indication_fdt).toLocaleString() : 'Non renseigné'}</div>
                  <div><span className="font-semibold">Devis associé :</span> {displayValue(affaire.devis_associe)}</div>
                </div>
                {/* Colonne 3 */}
                <div className="space-y-2">
                  <div><span className="font-semibold">Modification :</span> {displayValue(affaire.modification)}</div>
                  <div><span className="font-semibold">RG MOA :</span> {displayValue(affaire.rg_moa)}</div>
                  <div><span className="font-semibold">DOD :</span> {displayValue(affaire.dod)}</div>
                  <div><span className="font-semibold">Chef de projet :</span> {displayValue(affaire.chef_de_projet)}</div>
                  <div><span className="font-semibold">Pilote travaux :</span> {displayValue(affaire.pilote_travaux)}</div>
                  <div><span className="font-semibold">Délégation PRM/DET :</span> {displayValue(affaire.delegation_prm_det)}</div>
                  <div><span className="font-semibold">Type de décret :</span> {displayValue(affaire.type_decret)}</div>
                  <div><span className="font-semibold">CSPS :</span> {displayValue(affaire.csps)}</div>
                  <div><span className="font-semibold">Types de Comptes :</span> {displayValue(affaire.types_de_comptes || affaire.compte_projet)}</div>
                </div>
              </div>
              <div className="mt-6">
                <div className="font-semibold mb-1">Description :</div>
                <div className="bg-gray-50 border rounded p-4 text-gray-800 min-h-[60px]">
                  {displayValue(affaire.description_technique)}
                </div>
              </div>
            </>
          ) : (
            <p className="text-gray-400 text-center">Aucune description pour l'instant.</p>
          )}
        </div>
      </div>
      {/* Bloc lien vers les fichiers S3 */}
      <div className="w-full max-w-full mx-auto mt-4">
        <div className="bg-violet-600 rounded-t-lg px-6 py-5">
          <h2 className="text-lg font-bold text-white">Lien vers les fichiers de l'affaire</h2>
        </div>
        <div className="bg-white border rounded-b-lg shadow p-8 text-base">
          {affaire && affaire.s3_folder ? (
            <a href={affaire.s3_folder} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-all">
              {affaire.s3_folder}
            </a>
          ) : (
            <span className="text-gray-400">Aucun dossier renseigné</span>
          )}
        </div>
      </div>
      {/* Bloc Déclinaison budgétaire */}
      <div className="w-full max-w-full mx-auto mt-4">
        <div className="bg-violet-900 rounded-t-lg px-6 py-5">
          <h2 className="text-lg font-bold text-white">Déclinaison budgétaire</h2>
        </div>
        <div className="bg-white border rounded-b-lg shadow p-8 text-base">
          <span className="text-gray-400">À renseigner</span>
        </div>
      </div>
    </div>
  );
} 