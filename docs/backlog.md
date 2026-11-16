# Backlog

Pistes d'amélioration identifiées. Chaque élément garde le texte écrit au moment où il a été
trouvé ; ce document est trié par priorité, avec une taille estimée.

**Tailles (estimations, à revoir avant de commencer)** : **S** = moins d'une demi-journée,
**M** = une à deux journées, **L** = plusieurs jours.

## Vue d'ensemble

| Élément | Taille | Dépend de |
|---------|--------|-----------|
| Authentification, limitation d'appels, déploiement | L | [ADR 013](adr/013-deploiement-et-securite.md) (proposé) |
| Vérifier la confirmation annoncée avec un lecteur d'écran | S | un lecteur d'écran (NVDA) |
| Tests instables (cause non démontrée) | inconnue | un nouvel échec, avec son message exact |
| Ajouter captures d'écran et GIF au README | S | l'auteur du projet |
| Convertir `requirements.txt` en UTF-8 | S | rien |
| Colonne « Ajoutée le » | S | rien |
| Rejouer une fois les lectures sur les erreurs réseau | S | rien |
| Une erreur 500 garde ses en-têtes CORS | S | rien |
| Retenter le typage natif d'i18next | S (une heure au plus) | rien |
| Suppression d'un contact annulable | S | rien |
| Signaler les compétences introuvables dans l'offre | M | rien |
| Plafonner l'attente totale de l'extraction | M | route `async` |
| Enregistrer les compétences (et statistiques) | M | une migration |
| Évaluer l'extraction sur un jeu plus grand | M | quelques offres de plus |
| Détecter les modifications concurrentes | M | rien |
| Avertir champ par champ à l'import | M | un changement de l'API |
| Sélecteurs de date dans la langue de l'application | M | rien |
| Importer depuis Gmail | L | authentification (ADR 013) |
| Repasser à TypeScript 7 | S | une version compatible d'`openapi-typescript` |

## Priorité : avant toute mise en ligne

Authentification, limitation des appels à l'extraction et déploiement : voir
[ADR 013](adr/013-deploiement-et-securite.md) (statut : proposé, étape 9).

## Corrigé dans le code, vérification restante

- **Annoncer la confirmation aux lecteurs d'écran : corrigé dans le code, vérification restante.**
  Corrigé dans le commit `b82d90a` : la zone `role="status"` de la liste est présente et
  vide dès le premier rendu, puis remplie ; un test de rendu côté serveur le vérifie. **Reste à
  faire** : écouter le résultat avec un vrai lecteur d'écran (NVDA), car les tests par rôle ne
  prouvent pas ce qui est réellement annoncé. Texte d'origine du constat :
  > inséré dans un `role="status"` créé en même temps que lui : plusieurs lecteurs d'écran
  > n'annoncent une zone live que si elle existe **avant** le changement de son contenu. Corriger
  > en affichant la zone `role="status"` vide dès l'arrivée sur la liste, puis en y insérant le
  > message (même principe que la zone « Mise à jour… », déjà toujours présente). Vérifier avec un
  > vrai lecteur d'écran (NVDA), pas seulement avec les tests par rôle.

## Petites améliorations (S)

- **Ajouter les captures d'écran et le GIF du parcours d'import au README.** La liste des fichiers
  attendus et leurs emplacements sont dans la section « Screenshots » du README. À faire à la main,
  après `seed_demo --reset`.

- **Convertir `backend/requirements.txt` en UTF-8.** Le fichier est enregistré en UTF-16 (le
  résultat d'une redirection PowerShell de `pip freeze`). `pip` le lit correctement (vérifié sur
  un clone neuf), mais d'autres outils (éditeurs, `grep`, robots de mise à jour de
  dépendances, certains services de déploiement) peuvent le lire de travers. Reconvertir en
  UTF-8 et vérifier `pip install -r requirements.txt` dans un environnement neuf.

- **Colonne « Ajoutée le » dans la liste des candidatures.** L'API trie par `created_at`
  décroissant, mais la date n'apparaît pas à l'écran : l'ordre semble arbitraire. Afficher
  `created_at` au format `JJ/MM/AAAA` (en réutilisant `formatDeadline`, en prenant les 10
  premiers caractères de la date ISO ou en la convertissant dans le fuseau local) et
  ajuster les tests du tableau.

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

- **Suppression d'un contact : annulation possible.** Elle est directe et définitive (ADR 011).
  Pistes : une confirmation en ligne, ou un bouton « Annuler » pendant quelques secondes dans la
  zone de message (suppression réellement envoyée seulement après le délai).

## Améliorations moyennes (M)

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

- **Enregistrer les compétences extraites (`skills`).** L'extraction les renvoie, mais aucune
  colonne ne les stocke : elles sont affichées à la relecture puis perdues. À faire : une
  colonne (ou une table liée, une compétence pouvant servir à plusieurs candidatures), une
  migration Alembic, l'API (création, lecture, modification) et le formulaire. Elles pourraient
  alimenter une future **page de statistiques** (compétences les plus demandées, par statut ou
  par période). Choix à faire alors : une liste de texte libre (simple, mais « Node », « node.js »
  et « NodeJS » comptent pour trois) ou une table de compétences normalisées (plus de travail,
  des comptages fiables).

- **Évaluer l'extraction sur un jeu plus grand.** L'évaluation (4 offres, 3 passages chacune,
  ADR 006) ne permet pas de calculer un taux de réussite. Construire un jeu d'une vingtaine
  d'offres variées (avec leur réponse attendue champ par champ), un script qui mesure chaque
  champ et le coût, et le relancer à chaque changement de modèle ou de prompt. Les offres
  personnelles restent hors du dépôt (`backend/samples/` est ignoré par Git).

- **Détecter les modifications concurrentes.** Si deux sessions modifient la même candidature ou
  le même contact, le dernier enregistrement gagne sans avertissement (ADR 011). Piste : un
  numéro de version (ou `updated_at`) renvoyé par l'API et exigé au `PATCH`, avec une erreur 409
  traduite côté frontend.

- **Avertir champ par champ plutôt que d'un bloc.** L'écran d'import affiche un avertissement
  général (le poste et la date limite), car le serveur ne dit pas quel champ est douteux.
  Piste : faire renvoyer par l'extraction une indication par champ (par exemple « plusieurs dates
  dans le texte »), puis la montrer à côté du champ concerné.

- **Sélecteurs de date et d'heure dans la langue de l'application.** `<input type="date">` et
  `datetime-local` suivent la langue du navigateur (ADR 010 et 011). Un composant maison réglerait
  cela, au prix d'un sélecteur accessible à écrire et à tester.

## À investiguer

- **Tests instables dans `ApplicationFormPages.test.tsx` : cause non démontrée.** Sur environ
  25 lancements complets, deux tests ont échoué une fois chacun (« clic double » puis
  « création et confirmation »), puis ont repassé ; une boucle de 15 lancements n'a rien
  reproduit, et l'erreur exacte n'a pas été relevée. **Hypothèse, non vérifiée :** le délai
  d'attente par défaut de `findBy*`/`waitFor` (1 s) est dépassé sur une machine chargée. Le
  passage à 3 s (`asyncUtilTimeout`, `src/test/setup.ts`) peut masquer le problème sans le
  régler. Si un test échoue à nouveau : relever le message exact avant de relancer, puis
  chercher la vraie cause (course entre une requête simulée et une mise à jour, état partagé
  entre tests, minuteur). Revenir ensuite à 1 s si la cause est autre.
  **Mesures du 2026-11-16 :** un troisième échec (même test « création et confirmation ») est
  survenu après le passage à 3 s, mais seul le nom du test a été relevé (sortie filtrée), pas le
  message. 20 lancements complets de `a1423e2` : 0 échec ; 20 lancements avec le refactor
  `useServerErrors` : 0 échec. **Hypothèse à vérifier :** les échecs seraient liés à une
  modification de fichier pendant l'exécution de la suite (le seul échec enregistré n'a pas
  eu lieu sur les 40 lancements sans modification). Réserve : l'enchaînement des commandes de ce
  lancement n'indique pas de modification simultanée ; l'hypothèse n'est donc pas démontrée.
  Règle ajoutée au `CLAUDE.md` : ne rien modifier pendant les tests, garder la sortie complète.

## Version 2 et dépendances externes

- **Importer les candidatures depuis Gmail.** Connexion OAuth en lecture seule, recherche des
  e-mails de confirmation de candidature, extraction avec le service existant (`/job-postings`),
  puis **file de validation humaine** : rien n'est enregistré sans qu'une personne ait relu et
  accepté chaque candidature proposée. **Prérequis : l'authentification** (sans comptes, il n'y a
  personne à qui rattacher un jeton Gmail). Points à traiter avant de commencer :
  - **Jeton Gmail** : chiffré côté serveur (jamais en clair en base, jamais renvoyé au
    navigateur), avec une révocation possible.
  - **Restrictions de Google** : lire Gmail est un accès « restreint » ; en production il
    demande une vérification de l'application (et un audit de sécurité). Pour un usage
    personnel, le mode test de l'écran de consentement OAuth suffit (utilisateurs de test
    déclarés, jeton expirant au bout de 7 jours en mode test).
  - **Données sensibles envoyées au modèle** : des e-mails privés partiraient chez un
    fournisseur d'IA. Ne transmettre que ce qui est nécessaire (expéditeur, objet, extrait),
    prévenir l'utilisateur, et ne rien conserver sans son accord.
  - **Injection de prompt par e-mail** : un e-mail est un texte non fiable ; il peut contenir
    des instructions destinées au modèle. La sortie du modèle reste une donnée à valider (schéma
    strict, aucun outil ni action déclenchés par le modèle) ; la validation humaine est le dernier
    filet.

- **Repasser à TypeScript 7.** Le projet est en TypeScript 5.9.3 car `openapi-typescript`
  7.13.0 exige TypeScript 5 et plante avec TypeScript 7. Quand une version compatible sort :
  mettre à jour les deux, puis relancer `npm run build`, `npm run lint` et `npm run check:api`.
  Contexte : [ADR 008](adr/008-choix-techniques-du-frontend.md), section « Piège rencontré :
  TypeScript 7 contre openapi-typescript ».

Contexte (extraction) : [ADR 006](adr/006-extraction-d-offres-par-llm.md), section « Évaluation réelle ».
