# Oligart Prospect — Copilot commercial & carrière

Assistant de développement commercial et de carrière pour Rodolph : trouver des
missions de conseil, trouver des postes de direction commerciale, détecter les
entreprises prometteuses et contacter les bons décideurs.

Stack volontairement simple : HTML/CSS/JS natif (aucun framework, aucun build
step), stockage local (`localStorage`), et deux fonctions Netlify pour l'envoi
d'email (SMTP Gandi) et la génération assistée par IA (API Anthropic).

**Règle n°1 du projet : l'application ne doit jamais afficher de page vide ni
casser. Chaque module additionnel est chargé indépendamment, protégé par des
`try/catch`, et se dégrade proprement (message clair, repli local, état vide
explicite) si une donnée manque ou qu'un appel réseau échoue.**

## Fonctionnalités

1. **Dashboard** — métriques clés, relances dues, opportunités carrière (pipeline),
   activité récente (fusion outreach + signaux marché).
2. **Base prospects** — 200 entreprises minimum, avec CEO, Head of Sales, LinkedIn,
   email professionnel (quand disponible), site, notes, timeline de contacts,
   statut de pipeline.
3. **Top Priorités** — les 30 entreprises au score le plus élevé.
4. **Outreach** — séquence multi-canal (Email → LinkedIn → Relance email → Téléphone),
   historique de contact par prospect, hub listant les actions dues.
5. **Radar Marché** — journal de signaux (levée de fonds, recrutement, nouveau
   pays, changement de CEO/CRO) loggués manuellement par Rodolph et centralisés,
   filtrables par type. *Aucune donnée n'est inventée : pas d'API financière/emploi
   connectée à ce stade — c'est un outil de veille structurée, pas un flux "live".*
6. **Opportunités carrière** — suivi des postes en veille (VP Sales, GM, Country
   Manager, CRO, Head of Sales), avec statut, source, lien, notes.
7. **Assistant IA** — génération de brouillons (email, DM LinkedIn, pitch,
   préparation de RDV, compte rendu) depuis la fiche prospect. Toujours
   éditable. **Repli local automatique** si l'IA n'est pas configurée ou
   indisponible : l'app reste utilisable sans clé API.
8. **Paramètres** — signature, portfolio, lien CV (stockés localement), et
   statut des intégrations (SMTP, IA) sans jamais exposer les secrets.

## Architecture des fichiers

```
index.html          Structure + toutes les vues (nav générique par data-view)
styles.css           Styles (additions marquées "Copilot suite additions")
data.js              200 prospects (window.OLIGART_SEED)
app.js               Cœur : rendu dashboard/pipeline/board/relances, fiche
                      prospect, migration défensive, API partagée window.Oligart
priorities.js         Vue Top 30
outreach.js           Séquences + historique
radar.js              Signaux marché
career.js             Pipeline carrière (stockage indépendant)
ai.js                 Panneau IA + repli local
settings.js           Signature/portfolio/CV + statut intégrations
dashboard-extra.js    Widgets Opportunités + Activité sur le dashboard
netlify/functions/
  send-email.js       Envoi SMTP (existant)
  generate.js          Génération IA (Anthropic API)
  status.js            Statut booléen des intégrations (aucun secret exposé)
```

Chaque module additionnel (`priorities.js`, `outreach.js`, `radar.js`,
`career.js`, `ai.js`, `settings.js`, `dashboard-extra.js`) :
- ne modifie jamais directement le tableau `prospects` — il passe par l'API
  `window.Oligart` (save, addTimelineEntry, addSignal, openProspect...) ;
- s'enregistre via `window.Oligart.registerRenderHook()` quand il a besoin
  d'être rafraîchi après chaque sauvegarde ;
- est encapsulé dans un `try/catch` à l'initialisation et au rendu : une
  erreur dans un module n'empêche jamais le reste de l'app de fonctionner.

## Mise en ligne (Netlify)

1. Connecter le dépôt sur Netlify, laisser les réglages détectés depuis `netlify.toml`.
2. Variables d'environnement à ajouter :
   - **SMTP (envoi d'emails)** : `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`.
   - **Assistant IA (optionnel)** : `ANTHROPIC_API_KEY` (et `ANTHROPIC_MODEL` si tu veux
     forcer un modèle différent de `claude-sonnet-4-6`).
3. Aucune variable Supabase n'est nécessaire.

Sans `ANTHROPIC_API_KEY`, l'assistant IA fonctionne quand même : il bascule
automatiquement sur des modèles de texte générés localement (moins riches,
mais toujours utilisables), et l'indique clairement dans l'interface.

## Données & confidentialité

Toutes les données de prospection restent **sur l'appareil de l'utilisateur**
(`localStorage`) : prospects, timeline, signaux, pipeline carrière, paramètres.
Aucune base de données distante. Utiliser « Exporter CSV » pour sauvegarder
ou migrer les données.

## Limites connues

- Persistance locale uniquement (pas de sync multi-appareils).
- La fonction `send-email` n'a pas d'authentification applicative : à protéger
  par un token si l'app devient accessible publiquement.
- Le Radar Marché est un journal manuel, pas un flux connecté à des APIs
  financières/emploi tierces (aucune n'était disponible pour ce build).
