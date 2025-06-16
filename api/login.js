const https = require('https');

// Créez un agent HTTPS avec l'option rejectUnauthorized définie sur false
const agent = new https.Agent({
    rejectUnauthorized: false, // Désactive la vérification SSL (uniquement pour le développement)
});

// Exemple de requête avec l'agent
const options = {
    hostname: 'liste-utilisateurs.s3.eu-central-1.amazonaws.com', // Assurez-vous que le hostname est correct
    port: 443,
    path: '/login',
    method: 'GET',
    agent: agent, // Utilisez l'agent pour ignorer les erreurs SSL
};

// ...existing code...