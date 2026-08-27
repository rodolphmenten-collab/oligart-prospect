# Oligart Prospect — Copilot commercial & carrière

Assistant de développement commercial et de carrière pour Rodolph : trouver des
missions de conseil auprès d'annonceurs PME pour structurer leurs achats media
en direct (honoraires transparents, format plus flexible qu'une agence
traditionnelle), trouver des postes de direction
commerciale, détecter les entreprises prometteuses et contacter les bons
décideurs.

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
2. **Base prospects** — 244 entreprises françaises et internationales (objectif
   250, quasiment atteint), classées par typologie sur 4 catégories issues du
   fichier de sourcing de Rodolph — **filtrables directement dans l'interface**
   (menu déroulant catégorie sur Prospects) :
   - **Franchises PME** (166) — réseaux franchisés avec budget média digital
     significatif (100-500k€/an), classés par secteur (Mode, Beauté,
     Restauration rapide, Assurance & Banque, Auto & Entretien, Immobilier,
     Optique, Éducation, Bricolage, Hôtellerie, etc.)
   - **Tourisme International** (43) — offices de tourisme, compagnies
     aériennes, chaînes hôtelières communiquant en France
   - **Agences Média Indépendantes** (53) — agences de conseil/achat média
     digital françaises, **exclusivement indépendantes** (jamais de Big
     Six — Publicis/Omnicom/WPP/Dentsu/Havas/IPG — explicitement exclues sur
     demande, ce sont de grandes structures où un pitch freelance/conseil
     n'a pas de sens). Sourcées de trois façons : AAMI (12 membres, dont 10
     déjà présents), recherche de marché complémentaire (7 agences), et le
     **Top 50 des agences de marketing digital France 2026** (digirocks.fr,
     25 agences sélectionnées pour leur volet media buying/paid media réel
     — SEA, social ads, programmatique — en excluant les agences pure
     création/SEO/dev sans achat media).

   Positionnement pour cette catégorie : Rodolph ne leur pitche pas du
   media buying (ce serait leur propre métier), mais un accompagnement
   freelance/conseil sur le business development, le management commercial
   et le media buying opérationnel — jamais formulé comme du
   "go-to-market". Recherche de contact ciblée sur le **CEO/fondateur, le
   Head of Digital ou le Head of Sales/Directeur Commercial** (pas le
   directeur marketing, sans objet pour une agence).
   - **Agences Pharma** (14) — agences spécialisées labos/biotech/medtech

   **Sans agence media identifiée** — sous-ensemble transversal (pas une 5e
   catégorie), avec deux niveaux de certitude clairement distingués dans
   l'interface (filtre dédié sur Prospects + widget Dashboard) :
   - **Confirmé (14, dont Club Med)** — champ `hasAgency`. Annonceurs dont
     la donnée source confirme explicitement l'absence d'agence média en
     France, ou dont l'internalisation est documentée publiquement (Club
     Med, sourcé via un article e-marketing.fr sur la vague
     d'internalisation).
   - **Probable (127)** — champ `likelyNoAgency`. Franchises PME à budget
     média modeste (<300k€/an) sans agence mentionnée dans le fichier
     source. **C'est une déduction, pas une donnée confirmée** — les
     agences full-service ciblent statistiquement plutôt les comptes à
     budget plus important, mais rien ne garantit qu'une franchise donnée
     n'a vraiment aucune agence. L'unique franchise du fichier avec une
     agence explicitement mentionnée (Midas → iProspect) est exclue de ce
     calcul.

   Cette distinction confirmé/probable est volontaire : la version "confirmé"
   reste courte et 100% vérifiée (ce type de donnée n'est presque jamais
   publié par les marques), la version "probable" est plus large mais
   toujours annoncée comme une hypothèse, jamais présentée comme un fait.

   Positionnement Oligart : aider ces annonceurs à structurer leur stratégie
   d'achat media 360° (display, social, vidéo, DOOH, audio, programmatique)
   en direct, avec des honoraires transparents — repris dans le message de
   prospection pré-rempli et tous les prompts de l'assistant IA.

   **140/244 prospects ont un contact réel pré-rempli** (nom, LinkedIn,
   parfois email/téléphone), extrait des fichiers sources de Rodolph — jamais
   inventé. Quand plusieurs profils LinkedIn figuraient sur une même ligne,
   le bon profil est associé au bon nom par correspondance de texte ; en cas
   de doute, le champ reste vide plutôt que de risquer une mauvaise
   attribution.
3. **Top Priorités** — les 30 entreprises au score le plus élevé.
4. **Outreach** — séquence multi-canal (Email → LinkedIn → Relance email → Téléphone),
   historique de contact par prospect, hub listant les actions dues.
5. **Radar Marché** — signaux (levée de fonds, recrutement, nouveau
   pays, changement de CEO/CRO). Deux sources fusionnées :
   - manuelle : Rodolph loggue ce qu'il repère depuis une fiche prospect
   - **scan à la demande** (fonction Netlify + API Anthropic avec recherche
     web réelle), déclenché depuis Paramètres, stocké centralement (visible
     depuis n'importe quel appareil, pas juste en local)
6. **Opportunités carrière** — suivi des postes en veille (VP of Sales, Head
   of Sales, Country Manager, General Manager, CRO), avec statut, source,
   lien, notes. Un scan à la demande interroge LinkedIn, APEC, Cadremploi,
   Welcome to the Jungle et Indeed et propose des offres avec lien direct ;
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
  _companies.json       Copie allégée des prospects (id/company/secteur/pays),
                        utilisée uniquement côté serveur par les scans
  _scan-lib.js          Logique de scan partagée (radar + carrière), testable
                        indépendamment de Netlify Blobs
  _store.js              Adaptateur Netlify Blobs (stockage centralisé)
  scan-run-background.js     Exécution réelle des deux scans (Background
                              Function, jusqu'à 15 min), déclenchée uniquement
                              à la demande — pas d'automatisme quotidien
  scan-trigger.js            Déclenchement manuel (bouton Paramètres),
                              limité à 1 fois / 10 min, invoque scan-run-background
  scan-status.js              Statut du dernier scan manuel (pour le polling client)
  radar-data.js               Lecture des signaux détectés
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

## Vue Emails (envoyés + boîte de réception)

Nouvelle vue dédiée, deux onglets :
- **Envoyés** — agrège les entrées `timeline` (channel `email`) de tous les
  prospects en une seule liste chronologique, cliquable vers la fiche.
  Aucun appel réseau : tout vient du `localStorage` déjà là.
- **Boîte de réception** — connexion IMAP réelle sur la boîte Gandi
  (`imap.gandi.net:993`), mêmes identifiants que l'envoi SMTP
  (`SMTP_USER`/`SMTP_PASS`) — rien de nouveau à configurer. Aperçu des 30
  derniers emails reçus (expéditeur, objet, date, statut lu/non-lu). Si les
  identifiants sont absents ou la connexion échoue, message d'erreur clair
  affiché (jamais une boîte vide silencieuse qui laisserait croire à
  l'absence d'emails).

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

## Scan à la demande (Radar Marché + Opportunités Carrière)

**Pas d'automatisme quotidien** — chaque scan consomme des crédits API, donc
Rodolph garde la main : rien ne tourne sans qu'il clique sur **"Lancer un
scan Radar + Carrière maintenant"** dans Paramètres.

- **Radar Marché** — scanne un lot de ~5 entreprises parmi les 248
  (réglable via `RADAR_SCAN_BATCH_SIZE`), cherche sur le web (levée de
  fonds, recrutement, expansion, changement CEO/CRO) via l'API Anthropic, et
  stocke les signaux trouvés. Rotation complète de la base en plusieurs
  déclenchements avec le réglage par défaut.
- **Opportunités carrière** — cherche des offres pour VP of Sales / Head of
  Sales / Country Manager / General Manager / CRO. **LinkedIn et APEC sont
  interrogés à chaque scan** (sources prioritaires), plus **un troisième
  site qui tourne** à chaque exécution parmi Cadremploi, Welcome to the
  Jungle et Indeed — 3 appels IA au lieu de 5, tout en couvrant les 5 sites
  sur la durée si Rodolph relance régulièrement. Une recherche indépendante
  par site (en parallèle) : si un site échoue, les autres remontent quand
  même leurs résultats. Stocke des suggestions avec lien direct vers
  l'annonce (jamais ajoutées directement au pipeline de Rodolph — il choisit
  "Ajouter" ou "Ignorer"). Toute offre sans lien direct exploitable est
  écartée automatiquement.

Le stockage est centralisé via **Netlify Blobs** (inclus, aucune variable
d'environnement supplémentaire à configurer, aucune base de données externe).
Le déclenchement manuel est limité à 1 fois toutes les 10 minutes pour
maîtriser le coût API.

**Important — honnêteté sur les données** : ces scans utilisent une
recherche web réelle. Si rien de fiable n'est trouvé, il n'y a *aucune*
donnée inventée à la place. Chaque signal détecté par le scan est marqué
« · auto » dans l'interface pour le distinguer d'un signal loggué
manuellement.

**Coût** : chaque scan consomme des tokens API (recherche web incluse,
3 appels pour la carrière + le lot radar). Ajuster `RADAR_SCAN_BATCH_SIZE`
à la baisse réduit encore le coût du côté radar.

## Career Engine gratuit (zéro IA, zéro crédit Anthropic)

Sprint "Oligart OS" : refonte de la recherche d'offres pour ne plus jamais
dépendre de crédits Anthropic. Fonctionne en parallèle du scan carrière IA
ci-dessus (qui reste disponible si des crédits existent), mais aucun des
deux n'est requis pour l'autre.

- **Sources** : Greenhouse et Lever (API JSON publiques officielles, par
  entreprise — liste éditable dans `career-companies.json`), **France
  Travail** (API officielle OAuth2, 300k+ offres, inscription gratuite sur
  francetravail.io — `FRANCETRAVAIL_CLIENT_ID`/`FRANCETRAVAIL_CLIENT_SECRET`,
  scan ignoré proprement si absentes), **LinkedIn** (endpoint invité public
  documenté, lecture seule, sans login ni cookie — peut se faire bloquer par
  LinkedIn après quelques requêtes, traité comme "indisponible" sans casser
  le reste du scan). APEC et Welcome to the Jungle ne sont **pas**
  implémentés en connecteur direct : ce sont des SPA React/Angular qui ne
  renvoient aucune donnée exploitable en simple requête HTTP (contrairement
  à Greenhouse/Lever/France Travail qui exposent une vraie API), et les
  contourner proprement demanderait soit un service tiers payant, soit une
  rétro-ingénierie fragile de leur API interne nécessitant vérification.
- **Scoring 100% local** (`career-scoring.js`) : barème JS exact (titre,
  secteur, responsabilités détectées par mots-clés, séniorité, localisation,
  malus junior/stage/SDR), aucun appel réseau, aucune IA.
- **Déduplication** par empreinte (entreprise + titre normalisé + lieu) :
  une même offre présente sur plusieurs sources n'apparaît qu'une fois.
- **Actualisation automatique deux fois par jour** (07h/17h UTC, Netlify
  Scheduled Function) plus un bouton "Actualiser les offres" à la demande.
  Stockage dans Netlify Blobs (`career-jobs-free`), pas de Supabase dans ce
  projet — tout reste cohérent avec le principe "aucune base de données
  externe" déjà en place pour le reste de l'app.
- **Résilience** : chaque source est interrogée indépendamment
  (`Promise.allSettled`) — l'échec d'une source (LinkedIn bloqué, France
  Travail non configuré...) n'empêche jamais les autres de remonter des
  résultats. Statut par source affiché dans l'interface.

## Données & confidentialité

Toutes les données de prospection restent **sur l'appareil de l'utilisateur**
(`localStorage`) : prospects, timeline, signaux, pipeline carrière, paramètres.
Aucune base de données distante. Utiliser « Exporter CSV » pour sauvegarder
ou migrer les données.

## Mise à jour de la base de prospects (fusion intelligente)

Quand `data.js` est mis à jour (nouveaux prospects, nouveaux champs comme
`hasAgency`), l'app **fusionne automatiquement** la nouvelle base avec les
données déjà sauvegardées localement, à chaque chargement — plus besoin de
cliquer sur quoi que ce soit :

- Les champs "possédés" par l'utilisateur (statut, priorité, contact, CEO,
  Head of Sales, notes, "pourquoi", relance, historique, signaux...) sont
  **toujours préservés** depuis le stockage local.
- Les champs structurels (nom, secteur, catégorie, score, `hasAgency`...)
  se mettent à jour automatiquement depuis la nouvelle base.
- Les prospects ajoutés à la main (bouton « + Ajouter ») ne sont jamais
  perdus, même s'ils n'existent pas dans le fichier source.

Le bouton « Réinitialisation complète » reste disponible en dernier recours
(efface vraiment tout), mais ne devrait normalement plus jamais être
nécessaire pour récupérer une mise à jour de la base.

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
