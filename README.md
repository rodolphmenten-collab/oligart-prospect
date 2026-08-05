# Oligart Prospect — Production source

CRM mono-utilisateur pour Oligart : pipeline Supabase, email Gandi, discovery public, suivi des recrutements Greenhouse/Lever et opportunités carrière média/tech/internet.

## Déploiement recommandé

1. Importer tous les fichiers de ce dossier dans le dépôt GitHub `oligart-prospect`.
2. Dans Netlify : **Add new project → Import an existing project → GitHub**.
3. Sélectionner le dépôt. Netlify détecte automatiquement `netlify.toml`.
4. Ajouter les variables d'environnement listées dans `.env.example`.
5. Déployer.

## Sécurité

- Ne jamais committer `.env` ou les clés secrètes.
- Régénérer toute clé ou tout mot de passe apparu dans une capture ou une conversation.
- `SUPABASE_SERVICE_ROLE_KEY` et `SMTP_PASS` restent exclusivement dans Netlify.

## Résilience

L'interface s'affiche immédiatement avec la copie locale. Supabase se connecte en arrière-plan avec un délai maximal. En cas d'erreur, le CRM reste utilisable localement. Le statut en bas à gauche permet de relancer la connexion.
