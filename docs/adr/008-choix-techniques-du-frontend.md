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

## Piège rencontré : TypeScript 7 contre openapi-typescript

Le scaffold installait TypeScript 7.0.2. Au moment d'ajouter `openapi-typescript` 7.13.0
(dernière version), `npm install` a refusé : l'outil déclare `typescript ^5.x` en dépendance
« peer » (une bibliothèque que le projet doit fournir lui-même, dans une version compatible).
Forcé avec `--legacy-peer-deps`, il plante (`ts.factory` est `undefined`) : TypeScript 7 est une
réécriture native qui n'expose plus l'ancienne API JavaScript dont le générateur dépend. Un
contournement par `overrides` a aussi été refusé par npm.

Décision : **TypeScript 5.9.3, une seule version dans le projet** (versions exactes, sans `^`
ni `~`). Alternatives écartées : garder deux versions de TypeScript (fragile), ou changer de
générateur (remet en cause un choix validé). `npm run build` et `npm run lint` passent comme
avant. On pourra repasser à TypeScript 7 quand `openapi-typescript` le supportera
(voir `docs/backlog.md`).

## Le contrat OpenAPI et la couche d'appels (étape 3)

**Contrat.** `backend/openapi.json` est la description de l'API, générée sans serveur par
`python -m scripts.export_openapi` et versionnée. Le script et le test de péremption appellent
la même fonction `render_openapi()` (clés triées, indentation fixe, fin de ligne LF) : la
comparaison est déterministe. `.gitattributes` force LF sur ce fichier et sur les types, pour
que Git sous Windows ne les convertisse pas en CRLF.

**Types.** `frontend/src/api/schema.d.ts` est généré depuis ce fichier par
`npm run generate:api` ; il porte un en-tête « auto-generated » et ne s'édite pas à la main.

**Trois filets contre un contrat périmé :** (1) un test pytest compare `openapi.json` à
l'application ; (2) `npm run check:api` (`openapi-typescript --check`) compare les types au
contrat ; (3) le compilateur `tsc` refusera un code qui utilise un champ disparu (ce filet
deviendra actif dès que les écrans utiliseront ces types). Les filets 1 et 2 ont été vérifiés
en cassant volontairement un fichier.

**Un seul module d'appels.** Aucun composant n'appelle `fetch` : tout passe par
`src/api/client.ts`, qui a trois responsabilités : construire l'adresse, traduire les erreurs
et limiter l'attente. Une règle de lint (`no-restricted-globals` sur `fetch`, désactivée dans
`src/api/`) l'impose. Raison : si l'on change la gestion des erreurs, on la change à un seul
endroit, et les écrans ne connaissent pas le format de FastAPI.

**Traduction des erreurs** (`ApiError`, avec un `kind`) : 422 → erreurs par champ via
`detail[].loc` ; un `loc` réduit à `["body"]` (règle PATCH « X cannot be null ») → erreur
générale ; 404 → `not_found` ; 502 → `upstream` ; 503 → `unavailable` ; délai dépassé →
`timeout` ; `Failed to fetch` → `network`. Testé avec Vitest (15 tests, `fetch` simulé).

**Délai maximum.** 10 s par défaut, 60 s pour l'extraction (`EXTRACTION_TIMEOUT_MS`), réglable
par appel. Il repose sur `AbortController` : une télécommande pour une requête. On donne son
`signal` à `fetch` ; `controller.abort()` arrête la requête, qui échoue aussitôt. Le client
distingue « trop lent » (on affiche un message) d'« annulé par l'écran » (l'erreur
`AbortError` remonte telle quelle, ce n'est pas un échec à montrer). Limite : annuler côté
navigateur n'arrête pas le travail du serveur, donc l'appel au modèle (payant) continue.

## Conséquences

- (+) Un socle moderne, typé et testable ; chaque choix est défendable en entretien.
- (+) L'adresse de l'API est configurable sans toucher au code.
- (−) Plusieurs bibliothèques à apprendre (TanStack Query, React Router) : on les introduit
  une par une.
- (−) Les types générés ajoutent une étape à relancer quand l'API change.
- (−) Les variables `VITE_` étant publiques, il faudra y veiller à chaque ajout.
