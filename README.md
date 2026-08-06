# Oligart Prospect — clean build

Version volontairement simple : 200 prospects embarqués, stockage local, pipeline, LinkedIn et envoi SMTP Gandi.

## Mise en ligne GitHub
1. Supprimer les anciens fichiers du dépôt.
2. Charger le contenu de ce dossier à la racine.
3. Dans Netlify, connecter le dépôt et laisser les réglages détectés depuis `netlify.toml`.
4. Ajouter les variables `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`.

Aucune variable Supabase n'est nécessaire.
