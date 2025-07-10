"use client";
import React from 'react';

function FileList({ files }: { files: any[] }) {
  if (!files || files.length === 0) return <div className="text-gray-500">Aucun fichier dans ce dossier.</div>;
  return (
    <ul className="space-y-2">
      {files.map(file => (
        <li key={file.key} className="flex items-center gap-2">
          <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
            {file.key.split('/').pop()}
          </a>
          <span className="text-xs text-gray-400">({file.size} octets)</span>
        </li>
      ))}
    </ul>
  );
}

function FileUploadForm({ numero_affaire, onUploaded }: { numero_affaire: string, onUploaded: () => void }) {
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const fileInput = React.useRef<HTMLInputElement>(null);
  const successTimeout = React.useRef<NodeJS.Timeout | null>(null);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!fileInput.current?.files || fileInput.current.files.length === 0) {
      setError("Veuillez sélectionner au moins un fichier.");
      return;
    }
    setUploading(true);
    const formData = new FormData();
    Array.from(fileInput.current.files).forEach(f => formData.append('file', f));
    try {
      const res = await fetch(`/api/api_database/affaires/${numero_affaire}/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setSuccess('Fichier(s) uploadé(s) avec succès.');
        fileInput.current.value = '';
        onUploaded();
        // Masquer le message de succès après 2 secondes
        if (successTimeout.current) clearTimeout(successTimeout.current);
        successTimeout.current = setTimeout(() => setSuccess(null), 2000);
      } else {
        setError(data.error || 'Erreur lors de l\'upload.');
      }
    } catch (e: any) {
      setError(e?.message || 'Erreur lors de l\'upload.');
    } finally {
      setUploading(false);
    }
  };

  // Efface les messages lors d'une nouvelle sélection de fichier
  const handleFileChange = () => {
    setError(null);
    setSuccess(null);
    if (successTimeout.current) clearTimeout(successTimeout.current);
  };

  React.useEffect(() => {
    return () => {
      if (successTimeout.current) clearTimeout(successTimeout.current);
    };
  }, []);

  return (
    <form onSubmit={handleUpload} className="flex flex-col gap-2 mt-6 mb-4">
      <input type="file" multiple ref={fileInput} className="border rounded p-2" onChange={handleFileChange} />
      <button type="submit" className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded" disabled={uploading}>
        {uploading ? 'Upload en cours...' : 'Uploader'}
      </button>
      {error && <div className="text-red-600 text-sm">{error}</div>}
      {success && <div className="text-green-600 text-sm">{success}</div>}
    </form>
  );
}

export default function AffaireFilesClient({ numero_affaire }: { numero_affaire: string }) {
  const [files, setFiles] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/api_database/affaires/${numero_affaire}/list`);
      const data = await res.json();
      setFiles(data.files || []);
    } catch (e) {
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchFiles();
    // eslint-disable-next-line
  }, [numero_affaire]);

  return (
    <div className="bg-white border rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold mb-4">Fichiers de l'affaire</h2>
      <FileUploadForm numero_affaire={numero_affaire} onUploaded={fetchFiles} />
      {loading ? <div>Chargement...</div> : <FileList files={files} />}
    </div>
  );
} 