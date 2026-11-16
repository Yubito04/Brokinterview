# Backlog

Pistes d'amélioration identifiées, pas encore réalisées.

## Extraction d'offres (ADR 006)

- **Signaler les compétences introuvables dans le texte source.** Comparer chaque élément de
  `skills` au texte de l'offre (par exemple une recherche insensible à la casse) et indiquer
  dans la réponse ceux qui n'y figurent pas, pour aider la relecture. Cela aurait signalé
  « Docker » dans l'évaluation initiale. Une comparaison littérale ratera les variantes
  d'écriture (« UNIX/Linux » contre « Linux ») : elle sert à alerter, pas à rejeter.

- **Plafonner l'attente totale de l'extraction.** Le SDK respecte l'en-tête `Retry-After`
  d'une réponse 429 sans limite : le budget d'environ 41 s n'est alors pas garanti, et même
  sans `Retry-After` ce n'est pas un plafond strict (le délai d'httpx est par phase). Il faudrait une
  échéance globale (route `async` et client asynchrone avec `asyncio.timeout`, ou un plafond
  sur la pause). Voir ADR 006, section « Budget de temps ».

## Frontend (ADR 008)

- **Repasser à TypeScript 7.** Le projet est en TypeScript 5.9.3 car `openapi-typescript`
  7.13.0 exige TypeScript 5 et plante avec TypeScript 7. Quand une version compatible sort :
  mettre à jour les deux, puis relancer `npm run build`, `npm run lint` et `npm run check:api`.
  Contexte : [ADR 008](adr/008-choix-techniques-du-frontend.md), section « Piège rencontré :
  TypeScript 7 contre openapi-typescript ».
- **Rejouer une seule fois les requêtes de lecture, uniquement sur les erreurs réseau.**
  Le client TanStack Query est configuré avec `retry: false` (`frontend/src/queryClient.ts`) :
  les erreurs déjà traduites (422, 404, 503, 504, timeout) ne doivent pas être rejouées. Un
  `retry` en fonction (un seul essai si `error.kind === 'network'`) couvrirait les coupures
  brèves sans retarder les autres erreurs. À réserver aux requêtes GET, pas aux écritures.

- **Une erreur 500 non gérée doit garder ses en-têtes CORS.** Aujourd'hui, une exception non
  attrapée (vu pendant les essais : la migration `location`/`deadline` n'était pas appliquée,
  donc SQLAlchemy levait une erreur) renvoie une 500 *sans* `Access-Control-Allow-Origin`. Le
  navigateur bloque alors la lecture de la réponse, `fetch` échoue comme une panne réseau, et
  l'écran affiche « API injoignable » au lieu d'une erreur serveur.

  *Pourquoi.* Starlette empile des couches autour de l'application. La 500 des exceptions non
  gérées est fabriquée par `ServerErrorMiddleware`, la couche **la plus extérieure**, donc
  *au-dessus* de `CORSMiddleware` : la réponse ne repasse jamais par lui et personne n'y
  ajoute les en-têtes. Les erreurs gérées (422, 404, 503…) passent, elles, par le CORS. Un
  `@app.exception_handler(Exception)` ne règle rien : Starlette le range aussi dans
  `ServerErrorMiddleware`.

  *Pistes.* (1) Un middleware « attrape-tout » placé **à l'intérieur** du CORS (donc ajouté
  avant lui, car le dernier ajouté est le plus extérieur) qui attrape l'exception, la journalise
  et renvoie une 500 JSON propre : la réponse repasse par le CORS. (2) Des handlers pour des
  classes précises (`SQLAlchemyError`…) : ils vivent dans `ExceptionMiddleware`, à l'intérieur du
  CORS, mais ne couvrent pas les exceptions imprévues. Recommandation : (1), avec un test pytest
  (requête avec `Origin`, route qui lève, `raise_server_exceptions=False`) qui vérifie la 500 *et*
  l'en-tête CORS. Côté frontend, le client pourrait alors afficher un message « erreur du
  serveur » (kind `http`, statut 500) distinct de `network`.

- **Retenter le typage natif d'i18next, en temps limité (ADR 009).** Avec `i18next` 27.1.3
  et `react-i18next` 18.0.2, `t('pagination.next')` était refusé : seules les clés préfixées
  (`translation:pagination.next`) passaient, même avec une déclaration minimale. Le hook
  `useT` et le type `MessageKey` contournent le problème mais ne vérifient plus les variables
  (`{page, total}`). À retenter après une montée de version ou en comparant avec le projet
  d'exemple de la bibliothèque ; fixer une limite (par exemple une heure) avant de commencer, et
  garder `useT` si cela n'aboutit pas.

- **Colonne « Ajoutée le » dans la liste des candidatures.** L'API trie par `created_at`
  décroissant, mais la date n'apparaît pas à l'écran : l'ordre semble arbitraire. Afficher
  `created_at` au format `JJ/MM/AAAA` (en réutilisant `formatDeadline`, en prenant les 10
  premiers caractères de la date ISO ou en la convertissant dans le fuseau local) et
  ajuster les tests du tableau.

Contexte (extraction) : [ADR 006](adr/006-extraction-d-offres-par-llm.md), section « Évaluation réelle ».
