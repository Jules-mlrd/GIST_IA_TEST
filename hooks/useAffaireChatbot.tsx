import { useEffect, useState } from 'react';

export function useAffaireChatbot(affaireId: string) {
  // On ne gère plus le résumé ici
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);
    setFiles([]);

    fetch(`/api/files/${affaireId}`)
      .then(res => res.json())
      .then(data => { if (isMounted) setFiles(data.files); })
      .catch(e => { if (isMounted) setError('Erreur chargement fichiers'); })
      .finally(() => { if (isMounted) setLoading(false); });

    return () => { isMounted = false; };
  }, [affaireId]);

  return { files, loading, error };
} 