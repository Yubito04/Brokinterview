# ADR 008 — Choix techniques du frontend

- **Statut** : Accepté
- **Date** : 2026-11-10

## Contexte

L'API est prête (candidatures, contacts, extraction d'offres par LLM). Il faut une interface
web pour la liste avec filtres et pagination, le formulaire, le détail avec contacts et le
flux d'extraction avec relecture. Les décisions ci-dessous ont été prises avant d'écrire du
code ; chacune a été comparée à au moins une autre option.

## Options envisagées et décisions

| Sujet | Options | Décision | Raison principale |
|---|---|---|---|
| Outil de build | Vite, Create React App (abandonné), Next.js | **Vite** | Démarrage rapide, simple ; pas besoin de rendu côté serveur. |
| Langage | JavaScript, TypeScript | **TypeScript** | Les types attrapent les erreurs avant l'exécution. |
| Style | CSS Modules, Tailwind, bibliothèque de composants (MUI, Mantine) | **Tailwind CSS** | Lisible, répandu, sans rendu générique ; les composants restent à écrire. |
| Récupération des données | `fetch` + `useEffect`, TanStack Query, SWR | **TanStack Query** (après un premier `fetch` à la main) | Gère chargement, erreurs, cache et rafraîchissement. |
| Navigation | React Router, TanStack Router, aucun routeur | **React Router** | Standard ; filtres et page dans l'URL. |
| Types de l'API | À la main, générés (`openapi-typescript`), client complet généré | **Types générés, appels à la main** | Les types suivent le backend, les appels restent lisibles. |
| Formulaires | `useState`, React Hook Form | **`useState`** | Cinq champs ; la validation reste côté backend. |
| Tests | Vitest + React Testing Library, Jest | **Vitest + React Testing Library** | Même outil que Vite ; au minimum le flux d'extraction et l'affichage des erreurs 422. |

Seuls Vite, React, TypeScript et Tailwind sont installés à ce stade ; les autres arrivent avec
l'écran qui en a besoin.

## Adresse de l'API : variable `VITE_API_URL`

L'adresse vient de `frontend/.env` (`VITE_API_URL`), avec un `.env.example` versionné. Elle
n'est pas écrite en dur : elle changera au déploiement.

Vite recopie les variables `VITE_` dans le JavaScript compilé : **elles sont publiques**, tout
visiteur peut les lire. Règle : **aucun secret dans le frontend**. La clé Anthropic reste dans
`backend/.env` ; le navigateur ne fait qu'appeler l'API, qui utilise la clé de son côté.
Vite n'expose que les variables préfixées par `VITE_`, pour éviter de publier le reste du
`.env` par accident.

## Dépendances

`node_modules/` est ignoré par Git (reconstructible). `package-lock.json` est versionné : il
fixe la version exacte de chaque bibliothèque, pour que tout le monde installe la même chose.

## Piège rencontré : `localhost` contre `127.0.0.1` (IPv6 contre IPv4)

Le serveur de développement Vite écoute sur `localhost`, que Node résout ici en `::1` (IPv6) :
`netstat` montre `[::1]:5173`. Ouvrir `http://127.0.0.1:5173` (IPv4) donne
`ERR_CONNECTION_REFUSED`, car rien n'écoute sur IPv4. Décision : utiliser
`http://localhost:5173` et le documenter dans `frontend/README.md`. L'ADR 007 autorise les
deux origines ; en pratique une seule fonctionne avec les réglages par défaut. Alternative
écartée : `server.host: true`, qui ouvre le serveur au réseau local sans besoin.

## Conséquences

- (+) Un socle moderne, typé et testable ; chaque choix est défendable en entretien.
- (+) L'adresse de l'API est configurable sans toucher au code.
- (−) Plusieurs bibliothèques à apprendre (TanStack Query, React Router) : on les introduit
  une par une.
- (−) Les types générés ajoutent une étape à relancer quand l'API change.
- (−) Les variables `VITE_` étant publiques, il faudra y veiller à chaque ajout.
