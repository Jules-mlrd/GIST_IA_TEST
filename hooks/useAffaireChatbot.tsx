import { useEffect, useState } from 'react';

export function useAffaireChatbot(affaireId: string) {
  console.log('🚀 useAffaireChatbot - HOOK CRÉÉ avec affaireId:', affaireId);
  
  // On ne gère plus le résumé ici
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('🚀 useAffaireChatbot - useEffect DÉCLENCHÉ avec affaireId:', affaireId);
    
    if (!affaireId) {
      console.log('🚀 useAffaireChatbot - affaireId vide, arrêt');
      setLoading(false);
      return;
    }
    
    let isMounted = true;
    setLoading(true);
    setError(null);
    setFiles([]);

    console.log('🚀 useAffaireChatbot - HOOK APPELÉ');
    console.log('🚀 useAffaireChatbot - AffaireId:', affaireId);
    console.log('🚀 useAffaireChatbot - Appel API:', `/api/files/${affaireId}`);

    fetch(`/api/files/${affaireId}`)
      .then(res => {
        console.log('🚀 useAffaireChatbot - Réponse API:', res.status, res.statusText);
        return res.json();
      })
      .then(data => { 
        console.log('🚀 useAffaireChatbot - Données reçues:', data);
        if (isMounted) {
          setFiles(data.files || []); 
          console.log('🚀 useAffaireChatbot - Fichiers définis:', data.files?.length || 0);
        }
      })
      .catch(e => { 
        console.error('🚀 useAffaireChatbot - Erreur:', e);
        if (isMounted) setError('Erreur chargement fichiers'); 
      })
      .finally(() => { 
        if (isMounted) {
          setLoading(false);
          console.log('🚀 useAffaireChatbot - Loading terminé');
        }
      });

    return () => { 
      console.log('🚀 useAffaireChatbot - Cleanup');
      isMounted = false; 
    };
  }, [affaireId]);

  console.log('🚀 useAffaireChatbot - Rendu avec:', { files: files.length, loading, error });
  return { files, loading, error };
} 