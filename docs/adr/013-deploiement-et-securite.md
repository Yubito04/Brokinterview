# ADR 013 — Authentification, limitation d'appels et déploiement

- **Statut** : **Proposé** (rien n'est décidé ni réalisé : ce document prépare l'étape 9)
- **Date** : 2026-11-18

## Contexte

Aujourd'hui, l'application ne tourne que sur la machine de développement. Plusieurs ADR notent la
même limite : **personne ne protège l'API**.

- Pas d'authentification : quiconque atteint l'API lit, modifie et supprime toutes les données.
- Pas de limite d'appels : quiconque atteint `POST /job-postings/extract` dépense la clé Anthropic
  (chaque appel est payant). ADR 006 : « à ajouter avant tout déploiement public ».
- Les candidatures n'appartiennent à personne : il n'y a pas de notion d'utilisateur dans la base.
- Le CORS n'autorise que le serveur de développement (ADR 007).
- Les secrets (mot de passe de la base, clé d'API) sont dans un fichier `.env` local.
- Le texte d'une offre part chez un fournisseur d'IA ; une offre est un texte non fiable
  (injection de prompt, ADR 006 et 012).
- L'idée d'import depuis Gmail (backlog, version 2) a l'authentification pour prérequis.

Ce document liste les menaces, les options et une **proposition** d'ordre de travail. Il ne
choisit rien à la place de l'auteur du projet : les choix se feront au début de l'étape 9.

## Menaces

| Menace | Conséquence aujourd'hui | Réponse envisagée |
|--------|-------------------------|-------------------|
| Accès sans compte à l'API | Lecture, modification, suppression de toutes les données | Authentification, données rattachées à un utilisateur |
| Appels répétés à l'extraction | Dépense de la clé, sans plafond | Limite par utilisateur, plafond global, plafond côté fournisseur |
| Clé d'API ou mot de passe dans le dépôt, les journaux ou le navigateur | Vol de la clé, accès à la base | Secrets dans l'environnement de la plateforme, jamais dans le code ni dans `VITE_*` |
| Trafic en clair | Mots de passe et données lisibles sur le réseau | HTTPS partout |
| CORS trop ouvert (ou resté sur `localhost`) | Un autre site appelle l'API avec les cookies de l'utilisateur | Liste d'origines explicite par environnement |
| Injection de prompt dans une offre | Extraction dégradée, texte hostile affiché | Déjà atténuée (texte affiché comme du texte, relecture obligatoire, aucun outil pour le modèle) |
| Données personnelles envoyées à un fournisseur d'IA | Fuite de contenu privé | Note visible avant l'envoi (existe), minimiser ce qui part, conserver peu |
| Perte de données | Base perdue sans sauvegarde | Sauvegardes, migrations appliquées avant le démarrage de la nouvelle version |

## Options par sujet

### Authentification

| Option | Avantages | Inconvénients |
|--------|-----------|---------------|
| A. Comptes (courriel + mot de passe), session par cookie `HttpOnly` | Simple à expliquer, pas de service tiers, contrôle total | Stocker des mots de passe (hachage lent, par exemple argon2 ou bcrypt), réinitialisation à écrire |
| B. Jeton (JWT) dans l'en-tête | Courant pour les API consommées par plusieurs clients | Où stocker le jeton côté navigateur ? (un `localStorage` est lisible par un script injecté) ; révocation plus difficile |
| C. Connexion par un fournisseur (OAuth, par exemple Google) | Pas de mot de passe à stocker | Dépend d'un tiers, configuration d'application OAuth ; le même mécanisme servirait à l'import Gmail |

**Proposition** : A (cookie `HttpOnly`, `SameSite`, `Secure` en production), parce que le frontend et
l'API seront servis depuis le même site, ce qui évite la plupart des pièges du JWT. À confirmer.

Dans tous les cas : une colonne `user_id` sur `applications` (migration Alembic), **chaque requête
filtrée par l'utilisateur connecté** (les contacts se rattachent à l'utilisateur par leur
candidature), et des tests qui prouvent qu'un utilisateur ne voit pas les données d'un autre.

### Limitation des appels

| Option | Avantages | Inconvénients |
|--------|-----------|---------------|
| A. Bibliothèque de limitation de débit dans l'application | Simple, testable | Compteur en mémoire : perdu au redémarrage, faux avec plusieurs processus |
| B. Au niveau du proxy ou de la plateforme | Hors du code | Dépend de la plateforme ; ne connaît pas l'utilisateur |
| C. Quota par utilisateur enregistré en base (appels par jour) + plafond global par mois | Précis, survit aux redémarrages, protège le **budget** (le vrai risque) | Une table et des tests de plus |

**Proposition** : C pour `POST /job-postings/extract`, plus un **plafond de dépense configuré chez le
fournisseur d'IA** (indépendant de notre code). Une limite de débit simple (A) pour les autres routes
si besoin.

### Secrets et configuration

Variables d'environnement de la plateforme, une configuration par environnement (développement,
production), `.env` jamais commité (déjà le cas), aucun secret dans une variable `VITE_*` (déjà
documenté). Le CORS de production liste uniquement l'origine publique du frontend.

### Déploiement

| Option | Avantages | Inconvénients |
|--------|-----------|---------------|
| A. Plateforme gérée (backend en conteneur, base PostgreSQL gérée, frontend statique) | Peu d'administration, HTTPS fourni | Dépend d'un fournisseur ; les offres gratuites changent : **à vérifier au moment du choix** |
| B. Un serveur virtuel avec Docker Compose (API, base, reverse proxy) | Tout est sous contrôle, bon sujet d'entretien | Administration, mises à jour de sécurité, sauvegardes à gérer soi-même |

**Proposition** : conteneuriser le backend (un `Dockerfile`), construire le frontend en fichiers
statiques, appliquer **les migrations avant de démarrer la nouvelle version**, et choisir A ou B
selon l'objectif (démonstration en ligne rapide, ou compétence d'exploitation à montrer).

### Intégration continue

Un workflow GitHub Actions qui, à chaque envoi : lance `pytest` avec un service PostgreSQL,
vérifie le contrat OpenAPI, puis `npm run lint`, `npm run check:api`, `npm run test`,
`npm run build`. Sans CI, la règle « ne commiter que si les tests sont verts » ne repose que sur
la discipline.

## Ordre de réalisation proposé (étape 9)

1. Authentification et rattachement des données à l'utilisateur (backend, tests d'isolation, puis écrans
   de connexion et d'inscription en français et en anglais).
2. Limitation de l'extraction (quota par utilisateur, plafond global, message traduit quand la limite
   est atteinte) et plafond côté fournisseur.
3. Conteneurs, configuration de production, CORS de production.
4. Intégration continue.
5. Déploiement, puis relecture de sécurité (liste de contrôle ci-dessous).

## Liste de contrôle avant toute mise en ligne

- [ ] Aucun accès aux données sans connexion, vérifié par des tests.
- [ ] Un utilisateur ne peut ni lire ni modifier les données d'un autre (tests).
- [ ] L'extraction est limitée par utilisateur et plafonnée globalement.
- [ ] Aucun secret dans le dépôt, l'historique Git, les journaux ou le code du navigateur.
- [ ] HTTPS partout ; cookies `Secure`, `HttpOnly`, `SameSite`.
- [ ] CORS limité à l'origine publique.
- [ ] Sauvegardes de la base, et restauration essayée une fois.
- [ ] Les erreurs 500 ne montrent pas de détail interne.
- [ ] Le serveur de développement (`npm run dev`) n'est pas exposé.

## Conséquences

- **Si ce plan est accepté** : l'authentification touche chaque route et chaque test (les tests
  créent un utilisateur), le modèle de données change (migration), et l'écran doit gérer la
  déconnexion et l'expiration de session.
- **Si rien n'est fait** : l'application reste utilisable en local seulement ; la mettre en ligne
  telle quelle exposerait les données et la clé d'API.
