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
5. **Radar Marché** — signaux (levée de fonds, recrutement, nouveau
   pays, changement de CEO/CRO). Deux sources fusionnées :
   - manuelle : Rodolph loggue ce qu'il repère depuis une fiche prospect
   - **automatique** : un scan planifié quotidien (fonction Netlify + API
     Anthropic avec recherche web réelle) parcourt les 200 prospects par
     lots et enrichit le radar tout seul, stocké centralement (visible
     depuis n'importe quel appareil, pas juste en local)
6. **Opportunités carrière** — suivi des postes en veille (VP Sales, GM, Country
   Manager, CRO, Head of Sales), avec statut, source, lien, notes. Un scan
   automatique quotidien propose aussi des offres détectées sur le web ;
   Rodolph choisit de les ajouter à son pipeline ou de les ignorer — rien
   n'est ajouté sans action explicite de sa part.
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
  _companies.json       Copie allégée des 200 prospects (id/company/secteur/pays),
                        utilisée uniquement côté serveur par les scans
  _scan-lib.js          Logique de scan partagée (radar + carrière), testable
                        indépendamment de Netlify Blobs
  _store.js              Adaptateur Netlify Blobs (stockage centralisé)
  scan-radar-background.js   Scan quotidien planifié — Radar Marché
  scan-career-background.js  Scan quotidien planifié — Opportunités Carrière
  scan-trigger.js            Déclenchement manuel des deux scans (bouton
                              Paramètres), limité à 1 fois / 10 min
  radar-data.js               Lecture des signaux détectés automatiquement
  career-data.js               Lecture des suggestions carrière détectées
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

## Veille automatique quotidienne (Radar Marché + Opportunités Carrière)

Deux fonctions planifiées (cron) tournent chaque jour sans intervention :

- **`scan-radar-background`** (6h00 UTC) — scanne un lot de ~5 entreprises
  parmi les 200 (réglable via `RADAR_SCAN_BATCH_SIZE`), cherche sur le web
  (levée de fonds, recrutement, expansion, changement CEO/CRO) via l'API
  Anthropic, et stocke les signaux trouvés. Rotation complète des 200
  entreprises en ~40 jours avec le réglage par défaut.
- **`scan-career-background`** (6h10 UTC) — cherche des offres récentes pour
  VP Sales / GM / Country Manager / CRO / Head of Sales, stocke des
  suggestions (jamais ajoutées directement au pipeline de Rodolph).

Le stockage est centralisé via **Netlify Blobs** (inclus, aucune variable
d'environnement supplémentaire à configurer, aucune base de données externe).
Un bouton **"Lancer un scan maintenant"** dans Paramètres permet de
déclencher les deux scans à la demande (limité à 1 fois toutes les 10
minutes pour maîtriser le coût API).

**Important — honnêteté sur les données** : ces scans utilisent une
recherche web réelle. Si rien de fiable n'est trouvé pour une entreprise, il
n'y a *aucune* donnée inventée à la place. Chaque signal détecté automatiquement
est marqué « · auto » dans l'interface pour le distinguer d'un signal loggué
manuellement.

**Coût** : chaque scan consomme des tokens API (recherche web incluse). Avec
les réglages par défaut, le coût quotidien reste de l'ordre de quelques
centimes ; ajuster `RADAR_SCAN_BATCH_SIZE` à la baisse réduit encore ce coût.

**Prérequis Netlify** : les fonctions planifiées (« Scheduled Functions »)
doivent être disponibles sur le plan Netlify utilisé — vérifier dans les
paramètres du site si les crons apparaissent bien après déploiement. Si ce
n'est pas le cas, le bouton de déclenchement manuel reste utilisable, et le
reste de l'app n'est jamais affecté.

## Données & confidentialité

Toutes les données de prospection restent **sur l'appareil de l'utilisateur**
(`localStorage`) : prospects, timeline, signaux, pipeline carrière, paramètres.
Aucune base de données distante. Utiliser « Exporter CSV » pour sauvegarder
ou migrer les données.

## Limites connues

- Persistance des prospects/pipeline personnel/paramètres en local uniquement
  (pas de sync multi-appareils) ; en revanche, les signaux Radar Marché et
  suggestions carrière détectés automatiquement, eux, sont bien centralisés
  (Netlify Blobs) et visibles partout.
- La fonction `send-email` n'a pas d'authentification applicative : à protéger
  par un token si l'app devient accessible publiquement.
- Le Radar Marché combine journal manuel et détection automatique — cette
  dernière dépend de la qualité des résultats de recherche web disponibles
  au moment du scan, elle peut donc manquer des événements ou en trouver moins
  certains jours.
