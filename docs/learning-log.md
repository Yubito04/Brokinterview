# Learning log

Chaque concept appris, expliqué simplement, avec un exemple tiré du projet.
Les entrées les plus récentes sont en bas.

---

## 1. API REST et verbes HTTP

**Idée simple.** Une API REST, c'est un « guichet » : le client envoie une requête
(verbe + adresse), le serveur répond avec un code et des données.

- `GET` = lire, sans rien modifier (comme demander le menu au restaurant).
- `POST` = créer quelque chose de nouveau (comme passer une commande).

**Dans le projet.** `GET /health` lit l'état de l'API. `POST /applications` crée une candidature.

## 2. Codes de statut HTTP

| Code | Sens | Utilisé pour |
|------|------|--------------|
| 200 OK | Ça a marché | `GET /health` |
| 201 Created | Une ressource a été créée | `POST /applications` |
| 422 Unprocessable Entity | La requête est comprise, mais son contenu est invalide | champ obligatoire manquant |

**À retenir.** 201 est plus précis que 200 : il dit qu'une chose nouvelle existe maintenant.

## 3. Validation avec Pydantic

**Idée simple.** Un « guichetier » qui vérifie le formulaire avant de laisser passer.
On décrit la forme attendue dans une classe, Pydantic refuse tout ce qui n'y correspond pas.

```python
class ApplicationCreate(BaseModel):
    company: str          # obligatoire
    position: str         # obligatoire
    status: str = "APPLIED"   # optionnel : valeur par défaut
```

**Conséquence.** Si `company` manque, FastAPI répond `422` automatiquement et
ma fonction n'est jamais appelée. C'est la validation « aux frontières » du système :
on vérifie les données dès qu'elles entrent.

**Un champ avec valeur par défaut devient optionnel.**

## 4. Health check

**Idée simple.** Un endpoint minuscule (`GET /health`) qui répond « je suis vivant ».
Les outils de déploiement (Docker, load balancer) l'appellent pour savoir si l'appli tourne.

## 5. Tests avec pytest et TestClient

**Idée simple.** `TestClient` appelle l'application en mémoire, sans lancer de serveur.
Les tests sont donc rapides. Un test suit la forme : préparer, agir, vérifier.

```python
response = client.get("/health")
assert response.status_code == 200
```

On teste le cas normal (statut par défaut) **et** les cas d'erreur (422).

## 6. Environnement virtuel (venv) et requirements.txt

- **venv** : dossier isolé qui contient les paquets Python du projet, pour ne pas
  mélanger avec les autres projets.
- **requirements.txt** : liste des paquets avec leurs versions exactes, pour que
  quelqu'un d'autre (ou moi dans 6 mois) puisse recréer le même environnement.

## 7. .gitignore

Liste de ce que Git doit ignorer : `.venv/` (trop lourd, recréable), `.env`
(contient des secrets), `__pycache__/` (fichiers générés).

**Règle de sécurité du projet.** Jamais de clé API dans le code : fichier `.env` ignoré par Git.

## 8. ADR (Architecture Decision Record)

**Idée simple.** Un petit fichier qui garde la trace d'une décision : contexte,
options envisagées, décision, conséquences. Dans 6 mois, on sait *pourquoi* on a choisi ça.

**Exemple.** `docs/adr/001-choix-fastapi.md`.

## 9. Conventional Commits

Format de message de commit : `feat:` (nouvelle fonctionnalité), `fix:` (correction),
`test:`, `docs:`, `refactor:`, `chore:`. Le message est en anglais.

## 10. Configuration par variables d'environnement (.env)

**Idée simple.** Les réglages qui changent selon la machine (adresse de la base,
mot de passe) ne s'écrivent pas dans le code : ils vivent dans un fichier `.env`
que Git ignore. Le code, lui, est le même partout.

**Dans le projet.** `app/config.py` : la classe `Settings` (pydantic-settings) lit
`DATABASE_URL`. Elle n'a pas de valeur par défaut : si la variable manque,
l'application plante tout de suite avec une erreur claire, plutôt que de se
connecter au mauvais endroit en silence.
`.env.example` montre la forme attendue, sans secret, et lui peut être commité.

## 11. URL de connexion et engine SQLAlchemy

`postgresql+psycopg://USER:PASSWORD@localhost:5432/applyflow` se lit :
`type de base + pilote` `://` `utilisateur:mot de passe` `@` `machine:port` `/` `nom de la base`.

- **Pilote (driver)** : la bibliothèque qui parle le protocole de PostgreSQL (ici `psycopg`).
- **Engine** : l'objet SQLAlchemy qui gère les connexions. `create_engine` ne se
  connecte pas tout de suite : la connexion se fait à la première requête.

## 12. Tester sans toucher à l'environnement réel (monkeypatch)

`monkeypatch.setenv(...)` change une variable d'environnement *le temps d'un test*
puis remet tout comme avant. Les tests ne dépendent donc ni de mon vrai `.env`
ni de mon mot de passe.

## 13. ORM et modèles SQLAlchemy

**Idée simple.** Un ORM (Object-Relational Mapper) est un traducteur : une classe Python
= une table, un objet = une ligne, un attribut = une colonne. On manipule des objets
au lieu d'écrire du SQL à la main.

**Dans le projet.** `Application` (table `applications`) et `Contact` (table `contacts`)
dans `app/models.py`. Les deux héritent de `Base` (`app/database.py`), ce qui permet à
SQLAlchemy de les retrouver toutes.

## 14. Clé primaire, clé étrangère et relation un-à-plusieurs

- **Clé primaire** (`id`) : identifie chaque ligne de façon unique.
- **Clé étrangère** (`Contact.application_id`) : colonne qui pointe vers l'`id` d'une
  autre table. Elle crée le lien « ce contact appartient à cette candidature ».
- **Un-à-plusieurs** : une candidature, plusieurs contacts. `relationship` permet
  d'écrire `application.contacts` au lieu de faire la jointure soi-même.

**Analogie.** Une fiche de candidature avec des post-it de contacts collés dessus :
chaque post-it porte le numéro de la fiche.

## 15. Cascade `delete-orphan`

`cascade="all, delete-orphan"` règle le sort des contacts quand leur candidature change :
- supprimer la candidature supprime ses contacts ;
- retirer un contact de `application.contacts` le supprime de la base (plus d'« orphelin »).

Cela garde la base cohérente (intégrité référentielle) sans suppressions manuelles.

## 16. Enum

**Idée simple.** Un ensemble fermé de valeurs autorisées (`APPLIED`, `INTERVIEW`,
`OFFER`, `REJECTED`). Une valeur hors liste est refusée, donc pas de faute de frappe
silencieuse. Coût : ajouter une valeur demande une migration.

## 17. Donnée déduite plutôt que stockée

**Idée simple.** Si une information se calcule à partir d'autres, on ne la stocke pas :
deux copies finissent par se contredire.

**Dans le projet.** `Contact.state` est une propriété Python calculée à partir de
`contacted_at` et `replied_at`. Elle ne peut jamais être incohérente avec les dates.
Contrepartie : on ne peut pas filtrer dessus directement en SQL.

## 18. `server_default` : la base remplit la valeur

`created_at` utilise `server_default=func.now()` : c'est PostgreSQL qui écrit la date
à l'insertion. Elle est fiable et ne dépend ni du client ni de l'horloge de la machine
qui exécute le code. `DateTime(timezone=True)` stocke aussi le fuseau horaire.

## 19. Tester avec une base SQLite en mémoire

Les tests de `test_models.py` utilisent SQLite en mémoire : rapide, sans serveur,
et recréée à vide à chaque test. On vérifie les modèles sans toucher à PostgreSQL.
Limite : SQLite n'est pas PostgreSQL, certains détails (types, fuseaux) diffèrent.

## 20. Session SQLAlchemy et injection de dépendances (`Depends`)

**Idée simple.** Une session est une « conversation » avec la base : on y ajoute des objets
puis on les enregistre avec `commit`. Chaque requête HTTP a sa propre session.

**Injection de dépendances.** La route déclare ce dont elle a besoin, FastAPI le fournit :
```python
def list_applications(session: Session = Depends(get_session)):
```
`get_session` utilise `yield` : la session est donnée à la route, puis fermée
proprement quand la réponse est partie. Analogie : au restaurant, tu ne vas pas chercher
ta vaisselle en cuisine, le serveur te l'apporte et la reprend.

**Moteur vs session.** Un seul moteur pour toute l'application (`lru_cache`), car il gère
un pool de connexions coûteux à créer ; une session par requête, car elle garde un état.

## 21. Deux familles de modèles : schémas Pydantic et modèles SQLAlchemy

- **SQLAlchemy** (`models.py`) = la table, comment c'est stocké.
- **Pydantic** (`schemas.py`) = le contrat de l'API : `ApplicationCreate` (ce que le client
  envoie), `ApplicationRead` (ce qu'il reçoit, avec `id` et `created_at`).

`from_attributes=True` permet à Pydantic de lire directement un objet SQLAlchemy.
Analogie : le formulaire papier du guichet n'est pas le classeur d'archives.

## 22. PATCH et la règle du `null`

`PATCH` modifie seulement les champs envoyés. Avec `model_dump(exclude_unset=True)`, on
distingue un champ **absent** (ne pas toucher) d'un champ **`null`** (valeur explicite).
Règle du projet : `null` sur un champ obligatoire donne `422` ; `null` sur un champ
facultatif l'efface.

## 23. Codes 404 et 422, et 204

- `422` : la requête est invalide (champ manquant, statut inconnu).
- `404` : la requête est valide, mais la ressource n'existe pas.
- `204 No Content` : suppression réussie, rien à renvoyer.

## 24. Config robuste : chemin du `.env` et clés inconnues

`Path(__file__)` donne l'emplacement du fichier de code : le `.env` est trouvé quel que
soit le dossier de lancement. Pydantic refuse les clés inconnues du `.env` : il faut
déclarer chaque variable dans `Settings` (ici `test_database_url`, optionnelle).

## 25. Isoler les tests : transaction annulée et savepoint

**Idée simple.** Chaque test travaille sur un « calque transparent » qu'on jette à la fin.
- Une **transaction** regroupe des opérations « tout ou rien » ; `rollback` les annule.
- Un **savepoint** est un point de sauvegarde à l'intérieur d'une transaction. Avec
  `join_transaction_mode="create_savepoint"`, le `commit()` d'une route ne valide que ce
  point : la transaction externe, annulée à la fin du test, efface tout.
- Les tables sont créées une seule fois par session de tests (c'est lent).

## 26. Garde-fou pour les tests destructifs

Les tests suppriment des tables à la fin. Un verrou (`tests/db_safety.py`), appelé dans
`pytest_sessionstart` avant tout test, arrête la suite si la base de test est absente,
ne finit pas par `_test`, ou est la même que celle de développement. Il est lui-même testé.
Principe : transformer une erreur coûteuse en simple message d'arrêt.

## 27. Utiliser un port différent sous Windows

L'erreur `10013` au démarrage d'uvicorn sur le port 8000 vient de Windows qui refuse
l'accès à ce port (souvent une plage réservée par le système). On choisit simplement
un autre port libre, ici 8765 (`--port 8765`).

## 28. Migration de base de données (Alembic)

**Idée simple.** Une migration est un script versionné qui décrit un changement de schéma,
avec deux sens : `upgrade` (appliquer) et `downgrade` (annuler). C'est le « git » de la
base de données : chaque migration est un commit de schéma, et la base sait à quelle
version elle est (table `alembic_version`).

**Commandes.**
- `alembic revision --autogenerate -m "..."` : compare les modèles à la base et écrit le script.
- `alembic upgrade head` : applique toutes les migrations manquantes.
- `alembic current` : version actuelle. `alembic downgrade -1` : annule la dernière.

**Règles.** Toujours relire une migration autogénérée. Ne jamais modifier une migration
déjà appliquée : on en crée une nouvelle.

## 29. Anatomie d'un fichier de migration

- `revision` : identifiant de cette migration. `down_revision` : la précédente
  (`None` pour la première). Elles forment une chaîne, comme les commits.
- `upgrade()` et `downgrade()` : les deux sens, avec `op.create_table`, `op.drop_table`...
- `alembic/env.py` : le point de branchement. Il dit à Alembic où sont les modèles
  (`Base.metadata`) et comment se connecter à la base.

## 30. Les types enum PostgreSQL et le piège du downgrade

PostgreSQL stocke un enum comme un **type** séparé de la table. `create_table` le crée
automatiquement, mais `drop_table` ne le supprime pas. Le `downgrade` autogénéré laissait
donc `applicationstatus` en place, et un nouvel `upgrade` échouait (« le type existe
déjà »). Correctif : `op.execute("DROP TYPE applicationstatus")` à la fin de `downgrade()`.

## 31. Tests de garde pour les migrations

- **`alembic check`** (via `command.check`) : échoue si les modèles ont changé sans
  migration. Vérifié en ajoutant une colonne `salary` sans migration : le test échoue.
- **Aller-retour** `upgrade -> downgrade -> upgrade` : prouve que le downgrade est
  complet, y compris le type enum.
- **Vérifier que les tests savent échouer** : on casse volontairement le code (retirer
  `DROP TYPE`) et on constate que le test rouge apparaît. Un test jamais vu en échec
  n'est pas une preuve.

## 32. Robustesse : repartir d'un état propre

Mon essai de casse volontaire a laissé un type enum orphelin dans la base de test, et
toute la suite échouait ensuite. La fixture vide maintenant le schéma au démarrage
(`DROP SCHEMA public CASCADE`), ce qui est acceptable uniquement parce que le verrou
garantit qu'il s'agit de la base de test.

## 33. Pagination avec `limit` et `offset`

**Idée simple.** Un classeur de 250 fiches : « donne-moi 20 fiches en sautant les 40
premières » (`?limit=20&offset=40`). L'API ne renvoie jamais tout d'un coup.

- La réponse est une **enveloppe** : `{"items": [...], "total": 137, "limit": 20, "offset": 40}`.
  Le `total` (un `COUNT` avec les mêmes filtres) permet d'afficher « page 3 sur 7 ».
- Limite : un grand `offset` est lent, et des lignes ajoutées pendant la navigation décalent
  les pages. La solution pour de gros volumes est le **curseur** (`after_id`).

## 34. Valider les paramètres de requête

`Query(20, ge=1, le=100)` demande à FastAPI de vérifier que `limit` est un entier entre 1 et
100 avant d'exécuter la fonction. Sinon : `422`. Un maximum est indispensable : sans lui,
`limit=1000000` annulerait l'intérêt de la pagination. Un paramètre typé avec l'enum
(`status: ApplicationStatus | None`) rejette automatiquement une valeur inconnue.

## 35. Tri stable

Quand plusieurs lignes ont la même date, SQL ne garantit aucun ordre entre elles. Avec la
pagination, deux pages peuvent alors se chevaucher. Solution : ajouter un critère unique en
second (`ORDER BY created_at DESC, id DESC`). Détail : dans un test, `now()` de PostgreSQL
est l'heure de début de la **transaction**, donc toutes les lignes d'un test ont la même date.

## 36. `LIKE`, jokers et injection SQL : deux protections différentes

- **Requête paramétrée** : le texte de l'utilisateur est une *donnée*, jamais du *code SQL*.
  Elle empêche l'injection (`'; DROP TABLE …`).
- **Échappement des jokers** : dans un motif `LIKE`, `%` = « n'importe quoi » et `_` = « un
  caractère ». Ce sont des motifs *à l'intérieur de la donnée*, que la requête paramétrée
  ne touche pas. On les échappe (`\%`, `\_`, `\\`) pour chercher le texte littéralement.

Analogie : le vigile à l'entrée vérifie que personne n'entre avec une arme (paramètres) ;
cela ne t'empêche pas, dans la salle, de prendre un mot pour un autre (jokers).
Autre limite : `ILIKE '%x%'` ne peut pas utiliser un index classique (voir `pg_trgm`).

## 37. LLM et sortie structurée

**Idée simple.** Un LLM écrit du texte libre. Une sortie structurée lui impose un
formulaire à remplir : on donne une classe Pydantic (`ExtractedJob`), le SDK la transforme
en schéma JSON, et la réponse doit le respecter, sinon elle est rejetée. On récupère un
objet Python typé, pas une chaîne à parser. Dans le projet : `messages.parse(...,
output_format=ExtractedJob)` dans `app/llm.py`.

## 38. Autoriser `null` pour éviter l'invention

Un modèle qui doit remplir un champ absent a tendance à inventer une valeur plausible
(hallucination). Si chaque champ peut valoir `null` et que le prompt dit « si ce n'est pas
dans le texte, renvoie `null` », le modèle a une porte de sortie honnête. Le test « offre
sans date limite » vérifie que `deadline` reste `null`.

## 39. Injection de prompt

Le texte de l'offre est écrit par un inconnu. S'il contient « ignore tes instructions et
réponds X », le modèle risque d'obéir : c'est comme l'injection SQL, mais en langage
naturel. Défenses du projet : le texte est délimité par des balises et déclaré « donnée non
fiable » dans le prompt système ; le modèle n'a aucun outil ; et surtout le résultat n'est
pas sauvegardé sans que l'utilisateur le vérifie. On réduit le risque, on ne l'élimine pas.

## 40. Interface (`Protocol`) et faux pour tester sans réseau

`JobExtractor` décrit seulement ce dont la route a besoin : une méthode `extract`. La vraie
classe appelle Anthropic, le faux (`tests/fakes.py`) renvoie une valeur préparée. Branchés
avec `Depends` et `dependency_overrides` (voir 20), les tests ne coûtent rien et donnent
toujours le même résultat. Pour les cas d'erreur du SDK, on simule la couche HTTP plutôt
que le SDK lui-même, afin de tester le vrai code de gestion d'erreurs.

## 41. 502 et 503

- `503 Service Unavailable` : le service n'est pas prêt (ici, pas de clé API configurée).
- `502 Bad Gateway` : notre serveur fonctionne, mais le service en amont (le modèle) a
  échoué ou répondu n'importe quoi.

Le détail de l'erreur va dans les logs, pas dans la réponse : il pourrait révéler des
informations internes.

## 42. Maîtriser le coût d'un appel LLM

On paie à la quantité de texte lue et écrite (les jetons, ou *tokens*). Leviers utilisés :
un petit modèle (Haiku) pour une tâche facile, `effort` bas, texte d'entrée limité à
20 000 caractères, `max_tokens` borné, délai maximal (`timeout`) et peu de reprises
(`max_retries`). Et les tests ne touchent pas l'API par défaut : le marqueur `live_llm`
exclut les tests payants (`addopts = -m "not live_llm"`).

## 43. Origine, CORS et preflight

**Idée simple.** Une origine, c'est protocole + hôte + port. `http://localhost:5173` et
`http://127.0.0.1:8765` sont deux origines. Le navigateur est un vigile : il laisse ta page
envoyer la requête, mais ne lui remet la réponse que si l'API a signé un laissez-passer
(`Access-Control-Allow-Origin`) pour cette origine.

- **Preflight** : avant un `PATCH`, un `DELETE` ou un POST en JSON, le navigateur envoie
  d'abord un `OPTIONS` pour demander la permission. Le middleware de FastAPI y répond.
- `localhost` et `127.0.0.1` sont deux origines : on liste les deux (réglage `CORS_ORIGINS`).
- CORS protège l'utilisateur du navigateur, pas l'API : `curl` n'est pas concerné. Ce n'est
  pas de l'authentification.

## 44. `node_modules/`, `package.json` et `package-lock.json`

`package.json` est la recette : les bibliothèques voulues, avec une plage de versions
(`^19.3.1`). `node_modules/` contient les milliers de fichiers téléchargés : il se recrée avec
`npm install`, donc il est ignoré par Git. `package-lock.json` est le ticket de caisse : la
version exacte de chaque bibliothèque installée. On le versionne pour que chacun (et le
serveur de déploiement) installe exactement les mêmes versions.

## 45. Variables `VITE_` : publiques

Vite remplace `import.meta.env.VITE_API_URL` par sa valeur à la compilation : elle est écrite
dans le JavaScript que le navigateur télécharge, donc lisible par tous. Il n'expose que les
variables qui commencent par `VITE_`. Règle : aucun secret (clé API, mot de passe, jeton) dans
le frontend. Le secret reste dans le backend, qui l'utilise pour le compte du navigateur.

## 46. `localhost`, IPv4 et IPv6

`127.0.0.1` est « moi-même » en IPv4 ; `::1` est l'équivalent en IPv6. Le nom `localhost`
peut mener à l'un ou à l'autre. Vite écoute sur `localhost`, ici `[::1]:5173` (vu avec
`netstat -ano`) : `http://127.0.0.1:5173` donne `ERR_CONNECTION_REFUSED`, car rien n'écoute
en IPv4. Le serveur n'est pas en panne : il écoute dans l'autre famille d'adresses. On utilise
`http://localhost:5173`.

## 47. Une erreur CORS est masquée au JavaScript

Quand le navigateur bloque une réponse pour cause de CORS, le code JavaScript ne reçoit que
`TypeError: Failed to fetch`, le même message qu'un backend éteint. Le navigateur cache la
vraie cause exprès : il ne veut pas qu'une page malveillante puisse sonder ce que le serveur
répond. Pour distinguer les deux cas, il faut ouvrir la **Console** des outils de développement
(F12) : elle affiche « blocked by CORS policy… ». Vérifié en ouvrant l'application depuis le
port 5174, une origine non autorisée.

## 48. Premiers concepts React

- **Composant** : une fonction qui renvoie ce qu'on affiche (`App`).
- **JSX** : du HTML écrit dans le JavaScript ; `{...}` y insère du code.
- **État (`useState`)** : la mémoire du composant ; le changer redessine l'écran. Un type
  « union » (`loading` / `ok` / `error`) décrit les trois situations possibles.
- **Effet (`useEffect`)** : du code exécuté après l'affichage ; avec `[]`, une seule fois.
  C'est l'endroit pour appeler l'API.

## 49. Le contrat de l'API et les types générés

`openapi.json` décrit l'API ; les types TypeScript en sont tirés au lieu d'être réécrits à la
main. Si le backend change, le test pytest et `openapi-typescript --check` échouent tant que
les fichiers ne sont pas régénérés. Un fichier « généré » ne se modifie jamais à la main : on
modifie la source et on régénère. `.gitattributes` (`eol=lf`) empêche Git de changer les fins
de ligne d'un fichier dont on compare le contenu octet par octet.

## 50. Une dépendance « peer » et le piège de TypeScript 7

`openapi-typescript` déclare `typescript ^5.x` en peer : c'est au projet de fournir
TypeScript, dans une version compatible. Avec TypeScript 7, `npm install` refuse ; forcé,
l'outil plante (`ts.factory` n'existe plus). Décision : TypeScript 5.9.3 (ADR 008, backlog
pour y revenir). Je l'ai constaté en testant dans un dossier temporaire avant de toucher au
projet.

## 51. `AbortController` et le délai maximum

Une requête sans limite peut attendre indéfiniment. `AbortController` fournit un `signal` à
passer à `fetch` ; `abort()` arrête la requête. Un `setTimeout` déclenche `abort()` au bout du
délai, et on le désarme (`clearTimeout`) si la réponse arrive à temps. Un drapeau `timedOut`
distingue le délai de l'annulation volontaire. L'annulation ne prévient pas le serveur de
travailler pour rien.

## 52. Tester avec un faux `fetch` et de faux minuteurs

Le client reçoit `fetch` en paramètre : les tests le remplacent par une fonction qui renvoie
des réponses fabriquées (422, 502...), sans réseau. `vi.useFakeTimers()` fait avancer le temps
à la demande : un délai de 60 s se teste en quelques millisecondes. Vérifié en cassant
volontairement le code : deux tests ont échoué comme prévu.

## 53. Les délais diminuent en descendant dans la chaîne

Chaque couche (navigateur, backend, appel au modèle) a son délai maximum, et ils doivent
décroître : sinon la couche du dessus abandonne sans comprendre, et celle du dessous continue
de travailler (et de payer) pour rien. Le délai d'httpx est **par phase** d'une tentative, pas
un total ; avec les retries du SDK, le pire cas se calcule : tentatives × délai + pauses.
Un dépassement renvoie **504** (le service amont n'a pas répondu à temps), différent du 502
(mauvaise réponse ou panne) et du 503 (non configuré). `asyncio.timeout` n'aide pas dans une
route `def` : il n'interrompt que les coroutines. Mesuré : 12 appels réels, de 1,5 à 4,2 s.

## 54. Les filtres dans l'URL : `push` ou `replace`

Les filtres de l'écran liste (`?status=OFFER&q=acme&page=2`) vivent dans l'URL, pas dans un
`useState` : la page se recharge, se partage, se met en favori, et « Précédent » revient à
l'état d'avant. Chaque changement d'URL peut **ajouter** une entrée à l'historique (`push`) ou
**remplacer** l'entrée courante (`replace`). Page et statut : `push` (vraie navigation).
Recherche : `replace`, sinon taper « acme » laisse quatre entrées (a, ac, acm, acme). Une
correction (page trop grande ramenée à la dernière) est aussi un `replace`, sinon « Précédent »
ramène à la page invalide, qui redirige à nouveau : une boucle.

## 55. Page ↔ offset, et ne jamais faire confiance à l'URL

L'URL parle en pages (« page 3 »), l'API en offset (« saute 40 lignes ») :
`offset = (page - 1) × limit` et `totalPages = max(1, ceil(total / limit))`. Le `max(1, …)`
évite « page 1 sur 0 » quand la liste est vide. Comme l'URL est modifiable à la main, chaque
paramètre est relu strictement : `page=abc`, `-2`, `0`, `1.5`, `2abc` donnent la page 1 (une
expression régulière `^\d+$` plutôt que `parseInt`, qui accepterait `2abc`) ; un statut inconnu
ou en minuscules veut dire « pas de filtre ». Ces règles sont des fonctions pures, donc
testables sans écran.

## 56. TanStack Query : `keepPreviousData` et la clé de requête

`useQuery` met les réponses en cache selon une **clé** (`['applications', {status, q, page}]`) :
changer un filtre change la clé, donc lance une nouvelle requête (et annule l'ancienne grâce au
`signal`). Avec `placeholderData: keepPreviousData`, l'ancienne liste reste affichée pendant le
chargement au lieu d'un écran vide qui clignote ; `isPlaceholderData` permet d'afficher un
indicateur discret (« Mise à jour… ») et d'éviter d'agir sur des données qui appartiennent à
d'autres filtres. `retry: false` : par défaut, 3 essais espacés retarderaient l'affichage d'une
erreur déjà traduite par notre client.

## 57. Le debounce, et le champ qui ne doit pas écraser la frappe

Le debounce attend 300 ms de pause avant de mettre à jour l'URL : une requête par mot, pas par
lettre. Piège : le champ affiche un brouillon (`draft`) et l'URL est la source de vérité. Quand
l'URL change à cause du bouton Retour, le champ doit suivre ; mais quand elle change parce que
*nous* venons d'y écrire « ab » alors que l'utilisateur a déjà tapé « abc », le champ ne doit
surtout pas être remis à « ab ». Solution : mémoriser la dernière valeur envoyée (`useRef`) et
ne recopier l'URL dans le champ que si elle en diffère. `useEffectEvent` permet à l'effet
d'appeler la dernière version de `onSearch` sans se relancer à chaque rendu.

## 58. Tester par rôle et par nom (React Testing Library)

`getByRole('button', {name: 'Page suivante'})` cherche comme un utilisateur ou un lecteur
d'écran, pas par classe CSS ni position : le test survit à un changement de style, et il échoue
si un `<label>` manque (un lecteur d'écran n'annoncerait aucun nom). Un faux backend (une
fonction qui filtre et découpe un tableau) répond aux `fetch` des tests, ce qui vérifie les
vraies URL demandées sans réseau. Une zone `role="status"` doit exister *avant* que son texte
change pour être annoncée : elle est toujours rendue, vide la plupart du temps.

## 59. Une 500 sans CORS ressemble à une panne réseau

Pendant l'essai dans le navigateur, une base sans la migration `location`/`deadline` faisait
lever une erreur SQL à chaque requête : l'écran affichait « API injoignable ». Cause : la 500 des
exceptions non gérées est produite par la couche la plus extérieure de Starlette, au-dessus du
CORS, donc sans `Access-Control-Allow-Origin` ; le navigateur cache la réponse et `fetch`
échoue comme une coupure réseau. Leçon : relancer `alembic upgrade head` après chaque migration
(ajouté au README), et corriger la gestion des 500 (backlog). Un script de données de démo
(`scripts/seed_demo.py`) refuse les bases `_test` et ne supprime rien sans `--reset`.

## 60. Langue de l'interface du navigateur et langues annoncées aux sites : deux réglages

Le navigateur peut être affiché en français tout en annonçant à chaque site une liste de
langues préférées différente : `navigator.languages` vaut ici `['en-US', 'fr-FR', 'fr', 'en']`
(et c'est la même liste qui part dans l'en-tête HTTP `Accept-Language`). Le premier élément
étant l'anglais, une application sans choix mémorisé s'affiche en anglais : c'est le bon
comportement, pas un bogue. Les deux réglages se modifient à des endroits différents des
paramètres (langue d'affichage du navigateur ; langues préférées pour les pages web). Constaté
en testant dans le navigateur ; d'où le sélecteur visible et la mémorisation du choix.

## 61. Le `localStorage` est partagé par origine, pas par projet

Une origine, c'est schéma + hôte + port (`http://localhost:5173`). Tous les projets servis sur
cette adresse lisent et écrivent le **même** `localStorage` : on y a trouvé la clé d'un autre
projet. D'où le préfixe `applyflow.` (`applyflow.lang`) : sans lui, deux projets qui choisiraient
la clé `lang` s'écraseraient mutuellement. Corollaire : un projet qui tourne sur un autre port
(ou en production sur un autre domaine) ne voit pas ces données, et un utilisateur qui change
de navigateur ou d'appareil perd son choix de langue.

## 62. Un message pour le développeur, un texte pour l'utilisateur

Une erreur transporte deux choses distinctes : un `message` anglais, utile dans les journaux et
le débogueur, et ce que l'utilisateur lit, choisi d'après un **code stable** et écrit dans sa
langue. Côté API, Pydantic fournit déjà ce code : chaque erreur 422 a un `type`
(`string_too_short`) et un `ctx` (`{min_length: 1}`) ; on traduit d'après eux et jamais d'après
la phrase anglaise, qui peut changer d'une version à l'autre. Les codes se lisent dans les vraies
réponses de l'API plutôt que de se deviner : une date mal écrite donne
`date_from_datetime_parsing`, pas `date_parsing`. Une règle maison (« X ne peut pas être null »)
doit avoir son propre code : `PydanticCustomError("null_not_allowed", ..., {"field": nom})`
remplace un `ValueError`, que Pydantic aurait rangé sous le code générique `value_error`. Un
code inconnu, ou un détail manquant, donne un texte générique plutôt qu'une phrase cassée.

## 63. Une date sans heure et le fuseau horaire

`"2026-11-20"` n'a ni heure ni fuseau, mais `new Date(...)` en fait un instant précis (minuit UTC),
et `Intl.DateTimeFormat` l'affiche par défaut dans le fuseau du lecteur : à Los Angeles (UTC-8),
minuit UTC est encore le 19 au soir. Pour une date de calendrier (une échéance), on veut le même
jour partout : on formate donc en UTC (`timeZone: 'UTC'`). Dans le projet : `formatDeadline`, et un
test qui force `America/Los_Angeles`. Une vérification par mutation (retirer `timeZone`) a montré
que le test attrape bien l'erreur ; une première version, qui réglait `TZ` en ligne de commande,
ne prouvait rien, car Node sous Windows l'ignore à cet endroit.

## 64. Valider côté serveur seulement : une seule source de règles

Si le formulaire recopie les règles de l'API (« 1 à 200 caractères »), il y a deux endroits à
garder identiques, et ils finissent par diverger. Ici le formulaire n'a aucune règle : il envoie
ce que l'utilisateur a tapé, l'API répond 422 avec un code (`string_too_short`) et le formulaire
traduit ce code sous le bon champ. Le prix : un aller-retour réseau avant de voir l'erreur. Les
attributs `maxLength` (limiter la saisie) et `aria-required` (annoncer « obligatoire ») ne sont
pas de la validation : ils ne produisent aucun message.

## 65. Pourquoi `noValidate`

Avec l'attribut `required`, le navigateur bloque l'envoi et affiche sa propre bulle, **dans la
langue du navigateur**, pas dans celle de l'application : un utilisateur qui a choisi l'anglais
dans notre sélecteur verrait du français (ou l'inverse). `noValidate` sur le `<form>` coupe cette
validation ; `aria-required` garde l'information pour les lecteurs d'écran. Même limite pour
`<input type="date">` : le calendrier est dessiné par le navigateur, dans sa langue.

## 66. Un vrai PATCH : n'envoyer que ce qui a changé

`PATCH` signifie « modifier une partie » : un champ absent reste inchangé, `null` l'efface.
Le formulaire compare ce que l'utilisateur voit à ce qui est enregistré et n'envoie que
la différence : changer le statut envoie `{"status": "OFFER"}` et rien d'autre, vider le lieu
envoie `{"location": null}`. Renvoyer tous les champs écraserait une modification faite entre-temps
depuis un autre onglet. Si rien n'a changé, on n'envoie rien.

## 67. Une écriture ne se rejoue pas à l'aveugle

Une lecture peut être rejouée sans danger ; pas une création. Si un `POST` part mais que la
réponse se perd, la ligne existe peut-être déjà : le rejouer crée un doublon. Pour cela
`useMutation` ne rejoue pas par défaut, les fonctions d'écriture n'ont pas de signal
d'annulation, et le bouton est désactivé pendant l'envoi (un double clic ne part qu'une fois).

## 68. Après un échec, déplacer le focus

Un utilisateur au clavier ou avec un lecteur d'écran n'a pas de signal visuel : si une erreur
apparaît et que le focus reste sur le bouton, il ne sait pas que quelque chose a échoué. Le
formulaire envoie le focus sur le premier champ invalide (dont le message est lu grâce à
`aria-describedby`), ou sur le bloc d'erreur s'il n'y a pas de champ concerné.

## 69. Une zone `role="status"` doit exister avant son message

Un lecteur d'écran annonce le **changement** du contenu d'une zone live ; une zone qui apparaît
déjà remplie n'est pas toujours annoncée. C'est la raison de la zone « Mise à jour… » toujours
présente sur la liste, et la limite connue de la confirmation « Candidature créée. » (au
backlog). Les tests par rôle ne le détectent pas : seul un vrai lecteur d'écran le montre.

## 70. Un test instable (« flaky ») et pourquoi c'est dangereux

Un test instable réussit ou échoue **sans que le code ait changé**. Les causes habituelles : une
course entre deux opérations asynchrones (la requête simulée répond avant ou après le clic), un
minuteur réel (`setTimeout` de 50 ms) comparé à la vitesse de la machine, un état partagé entre
tests, un délai d'attente trop court sur une machine chargée. Le danger est double. D'abord, on
apprend à **relancer sans lire** : le jour où le test échoue pour une vraie raison, on le
relance aussi, et un vrai bogue passe. Ensuite, il détruit la confiance : si un rouge peut être
« normal », plus personne ne regarde. Règles : relever l'erreur exacte au premier échec, avant
de relancer ; remplacer les minuteurs par un événement contrôlé par le test (ici, le faux
serveur attend `release()`) ; ne pas « réparer » en allongeant un délai sans avoir démontré que
c'était la cause, car cela peut masquer le problème (entrée au backlog).

## 71. Un instant et une heure murale

`2026-11-10T10:00:00Z` est un **instant** : le même pour tout le monde. « 11:00 » est une
**heure murale** : elle n'a de sens qu'avec un fuseau (11:00 à Paris, 02:00 à Los Angeles pour
cet instant). L'API stocke des instants ; un champ `datetime-local` manipule des heures murales
sans fuseau. Le formulaire convertit dans les deux sens (`new Date(année, mois, jour, h, min)` lit
l'heure dans le fuseau local ; `toISOString()` la renvoie en UTC). Les tests forcent deux fuseaux,
en hiver et en été (le décalage de Paris passe de +1 à +2). Une date envoyée **sans** `Z` est lue
comme UTC par notre API : une convention à écrire, car Python refuse de comparer une date sans
fuseau et une date avec fuseau.

## 72. Comparer à la précision de ce qu'on affiche

Une date enregistrée à `10:00:30` s'affiche `10:00` dans le champ (précision : la minute).
Si on compare des instants pour savoir « est-ce modifié ? », `10:00:00` envoyé par le formulaire
diffère de `10:00:30` enregistré : le formulaire réécrirait une date que l'utilisateur n'a pas
touchée. On compare donc ce que le champ affichait au départ avec ce qu'il affiche à la fin.

## 73. Valider une règle sur l'état fusionné (PATCH)

Un `PATCH` ne transporte que les champs modifiés. La règle « la réponse ne précède pas le
contact » ne peut pas se vérifier sur les seuls champs reçus : envoyer `replied_at` seul doit être
comparé au `contacted_at` **déjà enregistré**. On calcule donc l'état après mise à jour (valeur
envoyée, sinon valeur enregistrée), puis on vérifie. Deux précisions : la règle ne s'applique que
si la requête touche une des deux dates (renommer un ancien contact incohérent reste possible), et
une requête refusée ne doit rien modifier en base.

## 74. Confirmer une action destructrice : le focus sur le choix sûr

Une confirmation n'a de valeur que si elle ne se valide pas par réflexe. On déplace le focus sur
« Annuler » à l'ouverture (un `Entrée` machinal annule), `Échap` ferme, et le focus revient sur
le bouton d'origine. Le texte dit **ce qui sera perdu** (« et ses 3 contacts »), et ne donne pas
de chiffre quand on ne le connaît pas. On évite `window.confirm` : il est dans la langue du
navigateur, comme les bulles de validation natives.

## 75. Retirer une requête du cache pendant qu'un écran l'observe la relance

Dans TanStack Query, `removeQueries` supprime l'entrée du cache. Si un écran encore monté
l'observe, il la recrée au prochain rendu et refait la requête : après la suppression d'une
candidature, l'écran redemandait ses contacts (un 404). Un test l'a montré. Le nettoyage se fait à
la sortie de la page (fonction de nettoyage d'un `useEffect`), quand plus personne n'observe.
Même idée que la clé de cache qui contient l'identifiant (`['contacts', id]`) : sans l'id, on
voit un instant les contacts de la candidature précédente.

## 76. Montrer le résultat d'un modèle : signaler le vide, mais aussi le rempli

Un modèle d'IA peut se taire (champ `null`) ou se tromper en affichant une valeur plausible. Les deux
demandent une réaction différente. Le champ vide est marqué « non trouvé dans l'offre » (c'est une
réponse du modèle, pas un oubli de l'utilisateur) ; le champ rempli porte un avertissement général,
parce que le risque principal est une valeur fausse qui a l'air juste. L'évaluation de l'ADR 006
désigne les deux champs à revérifier (le poste, la date limite). Aucune validation côté client :
l'utilisateur relit, le serveur valide à la création. Principe : un humain valide avant tout
enregistrement (« human in the loop »).

## 77. Annuler une requête arrête l'attente, pas le travail du serveur

`AbortController` coupe la connexion côté navigateur : `fetch` s'arrête et le code reprend la main.
Le serveur, lui, a peut-être déjà envoyé l'appel au modèle et le paiera quand même. Annuler
n'est donc pas un moyen d'éviter un coût déjà engagé ; c'est un moyen de ne plus attendre. Autre
détail : une annulation volontaire n'est pas une erreur à afficher, et un test doit vérifier que le
signal a été annulé, pas seulement que le bouton a disparu.

## 78. Pourquoi ne pas mettre `maxLength` sur un texte collé

Un `maxLength` fait **couper en silence** un texte collé trop long : l'utilisateur enverrait une
offre sans sa fin sans le savoir. Sans `maxLength`, le texte reste entier, un compteur montre
la limite et le serveur répond « trop long » (un refus qui ne coûte rien). `maxLength` reste
adapté à un champ court où la coupe se voit (200 caractères).

## 79. Compter comme le serveur : caractères et unités UTF-16

`'😀'.length` vaut 2 en JavaScript (deux unités UTF-16) et `len('😀')` vaut 1 en Python (un
caractère). Un compteur fondé sur `.length` annoncerait « trop long » pour un texte que le serveur
accepte. `Array.from(texte).length` compte les caractères comme Python. Même principe que pour les
dates : garder la même définition des deux côtés, et la tester avec le cas qui les distingue.

## 80. Un réglage de développement qui expose des fichiers

Vite refuse de lire un fichier hors de son dossier (`Denied ID`). `server.fs.allow: ['..']` le permet,
mais ce réglage vaut aussi pour `npm run dev` : le serveur de développement pourrait servir tout le
dépôt, `backend/.env` compris (la clé d'API), à quiconque l'atteint sur le réseau. On le limite au
mode test (`mode === 'test'`). Réflexe : se demander, pour tout réglage qui « débloque » un test, à
quoi il sert aussi ailleurs.

## 81. Un commit qui enchaîne le test sans lire son résultat

Une commande du type « lancer les tests puis commiter » commite même quand le fichier de test ne se
charge plus (un test qui ne se charge pas affiche « no tests », pas une erreur de test). Les
mutations lancées juste après semblaient prouver quelque chose alors qu'elles ne testaient rien. La
règle, ajoutée au `CLAUDE.md` : enregistrer la sortie complète, vérifier qu'elle ne contient ni
échec ni « no tests », puis commiter.

---

## Prochaines notions

- Documentation finale, relecture du projet et préparation de la démonstration.
- Authentification et limitation de débit avant tout déploiement.
