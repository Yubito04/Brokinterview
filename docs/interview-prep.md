# Préparation aux entretiens

Questions probables et réponses modèles, classées par thème.
À relire et à reformuler avec mes propres mots : une réponse récitée se remarque.

---

## Architecture

### Pourquoi FastAPI plutôt que Spring Boot ?

**Réponse modèle.** Mes projets universitaires démontrent déjà Java et Spring Boot.
Je voulais montrer une autre stack backend. Python est aussi l'écosystème naturel
pour intégrer des LLM, ce qui sert l'extraction d'offres d'emploi.
FastAPI apporte la validation (Pydantic) et une documentation OpenAPI (`/docs`)
quasi gratuites.

**Inconvénient à admettre.** Spring Boot impose plus de structure ; avec FastAPI,
je dois définir moi-même l'organisation du code.

*Référence : `docs/adr/001-choix-fastapi.md`.*

### À quoi sert un ADR ?

**Réponse modèle.** À garder la trace du *pourquoi* d'une décision : contexte,
options envisagées, décision, conséquences. Un nouveau développeur (ou moi plus tard)
comprend les choix sans devoir deviner.

### Où mets-tu le mot de passe de la base de données ?

**Réponse modèle.** Jamais dans le code. Il est dans un fichier `.env` ignoré par Git,
lu au démarrage par `pydantic-settings`. Je fournis un `.env.example` sans secret pour
documenter les variables attendues. Si la variable manque, l'application refuse de
démarrer au lieu de se connecter au mauvais endroit.

### Comment l'application lit-elle sa configuration (`.env`) ?

**Réponse modèle.** `pydantic-settings` remplit la classe `Settings` à partir des
variables d'environnement du système, puis du fichier `.env`. Les variables du système
ont la priorité, ce qui permet de surcharger la configuration en production sans fichier.
Le chemin du `.env` est calculé avec `Path(__file__)`, donc à partir de l'emplacement du
code et non du dossier de lancement. Le champ `database_url` n'a pas de valeur par
défaut : si elle manque, l'application refuse de démarrer.

**Détail piège.** Par défaut Pydantic refuse les clés inconnues du `.env`. Ajouter
`TEST_DATABASE_URL` sans déclarer le champ faisait planter l'application.

---

## API

### Que se passe-t-il si un client envoie `POST /applications` sans `company` ?

**Réponse modèle.** Pydantic valide le corps de la requête avant que ma fonction
ne s'exécute. Le champ obligatoire manque, donc FastAPI renvoie automatiquement
une erreur `422` avec le détail du champ fautif. Ma fonction n'est jamais appelée.

### Qu'est-ce que la validation « aux frontières » ?

**Réponse modèle.** On vérifie les données dès leur entrée dans le système
(ici avec Pydantic), pour que le reste du code puisse supposer qu'elles sont valides.

### Pourquoi `201` plutôt que `200` ? Différence entre GET et POST ?

**Réponse modèle.** `GET` lit une ressource sans la modifier. `POST` en crée une.
`201 Created` signale précisément qu'une ressource a été créée ; `200` dit seulement
que ça a marché.

### Pourquoi `DELETE` renvoie-t-il `204` ?

**Réponse modèle.** `204 No Content` signifie « c'est fait, et je n'ai rien à renvoyer ».
Après une suppression, il n'y a plus de ressource à décrire.

### Quand renvoyer `404` et quand renvoyer `422` ?

**Réponse modèle.** `422` : la requête est mal formée ou invalide (champ manquant, statut
inconnu, `id` qui n'est pas un entier). Pydantic le détecte avant que ma fonction ne
s'exécute. `404` : la requête est valide, mais la ressource demandée n'existe pas
(`GET /applications/999999`). Pour un contact, `POST /applications/999999/contacts` donne
aussi `404` : l'application parente n'existe pas.

### Quelle différence entre `PUT` et `PATCH` ? Comment gères-tu `null` ?

**Réponse modèle.** `PUT` remplace toute la ressource (le client renvoie tous les champs).
`PATCH` modifie seulement les champs envoyés. Pour distinguer « champ absent » de « champ
`null` », j'utilise `model_dump(exclude_unset=True)`. Ma règle, la même partout : un champ
absent n'est pas modifié ; `null` sur un champ obligatoire (`company`) renvoie `422` ;
`null` sur un champ facultatif (`replied_at`) l'efface. Elle est vérifiée par un
validateur Pydantic commun, donc le comportement est cohérent entre les candidatures et
les contacts.

### Pourquoi deux modèles : Pydantic et SQLAlchemy ?

**Réponse modèle.** Ils n'ont pas le même rôle. Le modèle SQLAlchemy décrit la **table**
(comment c'est stocké). Les schémas Pydantic décrivent ce que l'**API accepte et renvoie**.
Le client envoie `ApplicationCreate` (sans `id` ni `created_at`) et reçoit
`ApplicationRead` (avec les champs générés par la base). Séparer les deux m'empêche
d'exposer par erreur un champ interne et de laisser le client imposer un `id`. Si la
table change, le contrat de l'API peut rester stable.

**Inconvénient à admettre.** Les champs se ressemblent, donc il y a de la duplication.
C'est un choix volontaire pour garder l'API et le stockage indépendants.

### Pourquoi `response_model=ApplicationRead` sur les routes ?

**Réponse modèle.** `response_model` dit à FastAPI quelle forme a la réponse. FastAPI
convertit l'objet SQLAlchemy renvoyé par la route en `ApplicationRead` (grâce à
`from_attributes=True`) et ne garde que les champs de ce schéma. Je ne peux donc pas
exposer par erreur un champ interne, et la documentation `/docs` montre la vraie
réponse. C'est aussi une validation à la sortie : si la route renvoie une forme
inattendue, l'erreur apparaît tout de suite.

### Qu'est-ce que l'injection de dépendances dans FastAPI ?

**Réponse modèle.** Une route déclare ce dont elle a besoin
(`session: Session = Depends(get_session)`) et FastAPI le lui fournit. La route ne crée
pas elle-même sa connexion. Deux avantages : une session par requête, fermée proprement
à la fin (grâce au `yield`), et la possibilité de **remplacer** la dépendance dans les
tests avec `dependency_overrides`, sans modifier aucune route.

### Pourquoi `POST /applications/{id}/contacts` plutôt que `POST /contacts` ?

**Réponse modèle.** Un contact n'existe qu'à l'intérieur d'une candidature. Mettre
l'`id` de la candidature dans l'URL exprime cette relation parent-enfant (REST
hiérarchique) et rend l'erreur évidente : si la candidature n'existe pas, la réponse est
`404` avant même de lire le corps. Une fois créé, un contact est modifiable ou
supprimable directement par son propre `id` (`PATCH /contacts/{id}`), ce qui évite des
URLs interminables.

**Alternative écartée.** `POST /contacts` avec `application_id` dans le corps : valide
aussi, mais la relation est moins visible et il faut valider l'`id` à la main.

### Pourquoi un endpoint `/health` ?

**Réponse modèle.** C'est un endpoint de supervision : Docker, un load balancer
ou un outil de déploiement l'appellent pour savoir si l'application est vivante.

### Pagination : pourquoi `limit` + `offset` plutôt qu'un curseur ?

**Réponse modèle.** `GET /applications?limit=20&offset=40` veut dire « 20 lignes, en
sautant les 40 premières ». C'est simple à expliquer et à tester, et on peut sauter à
n'importe quelle page. Pour un tracker personnel de quelques centaines de lignes, c'est
suffisant. Un curseur (`?after_id=120`) part d'un repère au lieu de compter : il reste
rapide à toute profondeur et stable quand des lignes sont ajoutées pendant la navigation,
mais il est plus complexe et interdit de sauter à la page N.

**Limites de `offset` à admettre.** Sur une très grande table, PostgreSQL doit lire puis
jeter les lignes sautées, donc un grand `offset` est lent. Et si une ligne est ajoutée
pendant qu'on feuillette, une ligne peut apparaître deux fois ou être manquée. Je passerais
au curseur si la table devenait très grosse ou très active.

### Pourquoi la réponse est-elle une enveloppe avec `total` ?

**Réponse modèle.** Une simple liste ne dit pas combien de lignes existent au total : le
client ne peut pas afficher « page 3 sur 7 ». L'enveloppe
`{"items", "total", "limit", "offset"}` donne cette information. Le `total` est calculé
avec **les mêmes filtres** mais sans `limit`/`offset` : il compte les lignes qui
correspondent, pas celles de la page.

**Coût à admettre.** Un `COUNT` en plus à chaque appel, et le format n'est plus une liste
simple (changement cassant pour un client existant). J'ai fait le changement avant d'avoir
le moindre client, quand il ne coûtait rien.

### Pourquoi trier par date puis par `id` ? Qu'est-ce qu'un tri stable ?

**Réponse modèle.** Si plusieurs lignes ont la même date, SQL ne garantit aucun ordre entre
elles, et cet ordre peut changer d'une requête à l'autre. Avec la pagination, deux pages
pourraient alors se chevaucher ou sauter une ligne. Je trie donc par `created_at`
décroissant, puis par `id` décroissant : `id` est unique, donc l'ordre est **totalement
déterminé**. J'ai un test avec deux lignes créées au même instant et un test qui parcourt
toutes les pages sans doublon ni oubli ; en retirant le départage par `id`, ces tests
deviennent rouges.

### Pourquoi limiter `limit` à 100 et renvoyer `422` au-delà ?

**Réponse modèle.** Sans maximum, un client pourrait demander `limit=1000000` et reproduire
le problème que la pagination devait résoudre (réponse énorme, base surchargée). FastAPI
valide les paramètres de requête (`Query(ge=1, le=100)`, `offset >= 0`) avant que ma
fonction ne s'exécute : une valeur hors limites ou non numérique donne `422`. Le défaut est
de 20.

---

## Base de données

### Qu'est-ce qu'un ORM, et quels sont ses avantages et limites ?

**Réponse modèle.** Un ORM (Object-Relational Mapper) fait la correspondance entre des
classes et des tables : une classe = une table, un objet = une ligne. Je manipule des
objets Python (`application.contacts`) au lieu d'écrire du SQL et des jointures à la main.
Avantages : moins de code répétitif, protection contre l'injection SQL (les paramètres
sont liés, pas concaténés), code plus lisible. Limites : une couche de plus à comprendre,
des requêtes complexes parfois moins claires qu'en SQL, et un risque de requêtes
inefficaces si on ne sait pas ce que l'ORM génère (par exemple le problème « N+1 »).

### Que fait `create_engine` ? Se connecte-t-il tout de suite ?

**Réponse modèle.** Il crée l'objet qui gère les connexions à la base (avec un pool de
connexions réutilisables). Il ne se connecte pas immédiatement : la connexion est
ouverte à la première requête.

### Pourquoi créer le moteur une seule fois (`lru_cache`) mais une session par requête ?

**Réponse modèle.** Le moteur (engine) gère un pool de connexions réutilisables, coûteux
à créer : on en garde un seul pour toute l'application. La session représente une
« conversation » avec la base pour une requête et garde un état (objets suivis,
transaction en cours) : si deux requêtes la partageaient, elles se mélangeraient. Chaque
requête a donc sa propre session, fermée à la fin.

### Pourquoi appeler `session.refresh(objet)` après le `commit()` ?

**Réponse modèle.** Au moment du `commit`, l'objet n'a pas encore les valeurs que la
base génère elle-même : l'`id` auto-incrémenté et `created_at` (`server_default`).
`refresh` relit la ligne pour les remplir. Sans cela, la réponse `201` n'aurait pas
d'`id`, ce qui rendrait la ressource impossible à retrouver pour le client.

**Détail.** Par défaut, SQLAlchemy « expire » aussi les attributs après un `commit` et
les relit à la demande ; `refresh` rend ce rechargement explicite et prévisible.

### Pourquoi une table `contacts` séparée plutôt que des colonnes dans `applications` ?

**Réponse modèle.** Une candidature peut avoir plusieurs contacts (un recruteur RH,
un responsable technique, etc.) : c'est une relation un-à-plusieurs. Mettre des colonnes
`contact1`, `contact2`... dans `applications` serait limité (combien de colonnes ?),
plein de cases vides, et difficile à interroger. Avec une table `contacts` et une clé
étrangère `application_id`, j'ajoute autant de contacts que je veux, et chacun a son
propre historique (date de contact, date de réponse). C'est la normalisation : une
information à un seul endroit.

**Inconvénient à admettre.** Il faut une jointure pour lire une candidature avec ses
contacts, et un modèle de plus à maintenir. Pour un seul contact par candidature,
des colonnes auraient suffi.

*Alternative écartée : colonnes de contact directement dans `applications`.*

### Pourquoi l'état d'un contact (`NOT_CONTACTED`, `WAITING`, `REPLIED`) n'est-il pas stocké ?

**Réponse modèle.** Cet état se déduit de deux dates : si `replied_at` est rempli, le
contact a répondu ; sinon, si `contacted_at` est rempli, on attend ; sinon, il n'a pas
été contacté. Si je stockais aussi l'état dans une colonne, deux informations diront la
même chose et pourraient se contredire (état `NOT_CONTACTED` mais une date de réponse
remplie). En le calculant dans une propriété Python, il y a une seule source de vérité :
les dates. Le principe est d'éviter la redondance des données.

**Inconvénient à admettre.** On ne peut pas filtrer directement sur l'état en SQL
(`WHERE state = 'WAITING'`) ; il faudrait écrire la condition sur les dates. Si ce besoin
devient fréquent, on pourrait revoir ce choix.

### À quoi sert `cascade="all, delete-orphan"` sur la relation ?

**Réponse modèle.** Elle définit ce qui arrive aux contacts quand leur candidature
change. `delete` : si je supprime une candidature, ses contacts sont supprimés aussi,
sinon ils resteraient sans parent, ou la base refuserait la suppression à cause de la
clé étrangère. `delete-orphan` : si je retire un contact de la liste `application.contacts`,
il est supprimé de la base au lieu de rester orphelin. Cela garde la base cohérente
(intégrité référentielle) sans que j'écrive ces suppressions à la main.

**Précision.** C'est le comportement de SQLAlchemy côté Python ; ce n'est pas la même
chose que `ON DELETE CASCADE` côté base de données.

### Pourquoi `created_at` utilise-t-il `server_default=func.now()` ?

**Réponse modèle.** C'est la base de données qui remplit la date à l'insertion, pas le
client ni mon code Python. La date est donc fiable (le client ne peut pas la falsifier)
et cohérente, quelle que soit la machine qui insère. Le `timezone=True` stocke aussi le
fuseau horaire, pour éviter les ambiguïtés.

### Pourquoi un `Enum` pour le statut plutôt qu'un simple texte ?

**Réponse modèle.** Un enum limite les valeurs possibles (`APPLIED`, `INTERVIEW`,
`OFFER`, `REJECTED`). Une faute de frappe comme `"INTERVEW"` est rejetée au lieu d'être
stockée en silence, et le code peut s'appuyer sur un ensemble connu de valeurs.

**Inconvénient à admettre.** Ajouter un statut demande une migration de la base.

### Échappement des jokers `LIKE` ou requêtes paramétrées : quelle différence ?

**Réponse modèle.** Ce sont deux protections différentes, sur deux niveaux différents, et
l'une ne remplace pas l'autre.

1. **Requête paramétrée : protège contre l'injection SQL.** Le texte de l'utilisateur est
   envoyé à PostgreSQL séparément de la requête, comme une **donnée**, jamais collé dans le
   texte SQL. Si quelqu'un cherche `'; DROP TABLE applications; --`, c'est juste une chaîne
   de caractères à comparer, pas une commande. SQLAlchemy le fait pour tous les `.where(...)`.
2. **Échappement des jokers : concerne le langage `LIKE`.** À l'intérieur de la donnée,
   l'opérateur `LIKE` a son propre petit langage : `%` veut dire « n'importe quoi » et `_`
   « un caractère quelconque ». La requête paramétrée ne s'en occupe pas, car pour elle
   `%` est une donnée comme une autre. Si quelqu'un cherche `%`, sans échappement il obtient
   **toutes** les lignes. Je remplace donc `\`, `%` et `_` par leur version échappée et je
   déclare `escape="\\"`, pour que le texte soit cherché littéralement.

**La différence de conséquence.** Une injection SQL est un problème de **sécurité**
(lire, modifier ou supprimer des données). Un joker non échappé n'est pas une faille : il
donne des **résultats faux** (ou des motifs coûteux comme `%%%%%`). Mes tests le prouvent :
`q=%`, `q=_` et `q=\` ne renvoient que la ligne qui contient vraiment ce caractère, et
`q='; DROP TABLE …` ne casse rien.

**Ce qu'il ne faut jamais faire.** Construire la requête avec une f-string
(`f"... LIKE '%{q}%'"`) : l'échappement des jokers ne protégerait alors pas de l'injection.

### La recherche `ILIKE '%texte%'` passera-t-elle à l'échelle ?

**Réponse modèle.** Pas indéfiniment. Avec un `%` au début du motif, un index B-tree
classique ne sert à rien : PostgreSQL parcourt toute la table. C'est acceptable pour
quelques milliers de lignes. Si la table grossissait, j'ajouterais un index `pg_trgm`
(GIN), conçu pour les recherches partielles, ou la recherche plein texte de PostgreSQL.

---

## Migrations (Alembic)

### À quoi servent les migrations (Alembic) ? Pourquoi pas `create_all` ?

**Réponse modèle.** `create_all` crée les tables qui n'existent pas, mais ne sait pas
modifier une table existante : ajouter une colonne ou changer un type sans perdre les
données est impossible. Une migration est un script versionné avec un `upgrade` et un
`downgrade`. La base garde la version courante dans la table `alembic_version`. Je peux
donc faire évoluer le schéma proprement, le reproduire sur n'importe quelle machine
(développement, test, production) et revenir en arrière. C'est comme Git, mais pour le
schéma.

**Inconvénient à admettre.** Une étape de plus à maintenir, et l'autogénération n'est
pas parfaite : il faut relire chaque migration.

### Que fait `alembic revision --autogenerate` ? Peut-on lui faire confiance ?

**Réponse modèle.** Il compare les modèles SQLAlchemy (`Base.metadata`) à l'état réel de
la base et écrit le script des différences. On ne peut pas lui faire aveuglément
confiance. Dans mon projet, le `downgrade` généré supprimait les tables mais pas le
type enum PostgreSQL `applicationstatus` : un nouvel `upgrade` aurait échoué. Je l'ai
détecté en relisant la migration et corrigé avec `DROP TYPE`. Il ne détecte pas non plus
certains changements (renommage de colonne vu comme suppression puis ajout).

### Comment t'assures-tu qu'un modèle modifié ne reste pas sans migration ?

**Réponse modèle.** Un test lance `alembic check`, qui compare les modèles au schéma
produit par les migrations et échoue s'il y a une différence. J'ai vérifié qu'il
fonctionne en ajoutant volontairement une colonne au modèle sans migration : le test est
devenu rouge. Ainsi l'oubli est détecté en CI avant d'arriver en production.

### Comment testes-tu une migration ?

**Réponse modèle.** Deux choses. D'abord, toute la suite construit son schéma avec les
vraies migrations, donc `upgrade` est testé à chaque exécution et `downgrade` à la
fin. Ensuite, un test fait `upgrade -> downgrade -> upgrade` et vérifie qu'après le
`downgrade` il ne reste ni tables ni type enum, puis que le deuxième `upgrade` recrée
tout.

### Comment Alembic se connecte-t-il à la base sans mettre le mot de passe dans un fichier ?

**Réponse modèle.** `alembic.ini` ne contient aucune URL. `alembic/env.py` appelle la même
configuration que l'application (`get_settings()`), qui lit `DATABASE_URL` dans `.env`
(ignoré par Git). Les tests, eux, fournissent leur propre connexion à la base de test,
donc les migrations de test ne peuvent pas toucher la base de développement.

### Peut-on modifier une migration déjà appliquée ?

**Réponse modèle.** Non. Une fois appliquée sur une base (surtout partagée ou en
production), on la considère comme de l'historique : on crée une nouvelle migration qui
corrige. Modifier l'ancienne ferait diverger les bases qui l'ont déjà exécutée.
Exception : tant qu'elle n'a été appliquée que sur ma machine, je peux la corriger.

---

## Tests

### Comment testes-tu ton API ?

**Réponse modèle.** Avec pytest et le `TestClient` de FastAPI, qui appelle
l'application en mémoire sans serveur : les tests sont rapides. Je teste le cas
normal (statut par défaut `APPLIED`, statut explicite) et les cas d'erreur
(champ manquant → `422`).

### Pourquoi tester contre une vraie base PostgreSQL plutôt que SQLite ?

**Réponse modèle.** Pour que les tests ressemblent à la production : mêmes types, même
enum, mêmes contraintes. SQLite aurait été plus rapide, mais un bug propre à PostgreSQL
serait passé inaperçu. Mes tests de modèles utilisent SQLite (rapide, rien d'externe) ;
mes tests de routes utilisent PostgreSQL. Le coût : il faut un serveur qui tourne.

### Comment isoles-tu les tests entre eux ?

**Réponse modèle.** Les tables sont créées une fois par session de tests. Chaque test
s'exécute dans une transaction qui est annulée (`rollback`) à la fin, donc la base revient
vide pour le test suivant, même si le test a échoué. Comme mes routes appellent
`commit()`, je lie la session à la connexion avec
`join_transaction_mode="create_savepoint"` : le `commit` ne valide qu'un point de
sauvegarde, pas la transaction externe. C'est plus rapide que vider les tables ou les
recréer à chaque test.

**Limite à admettre.** Les `id` auto-incrémentés ne reviennent pas à 1 : un test ne doit
jamais supposer un `id` précis.

### Comment t'assures-tu que les tests ne détruisent pas ta vraie base ?

**Réponse modèle.** Trois protections. Les tests lisent uniquement `TEST_DATABASE_URL`.
Ils détournent la dépendance `get_session` pour que les routes utilisent la session de
test. Et un verrou, exécuté avant tout test, arrête la suite si l'URL de test est
absente, si le nom de la base ne finit pas par `_test`, ou si elle est identique à celle
de développement. Le verrou est lui-même testé.

**Limite à admettre.** Il vérifie le nom, pas le contenu de la base. En entreprise, on
ajouterait un utilisateur PostgreSQL qui n'a accès qu'à la base de test.

### À quoi sert `dependency_overrides` ?

**Réponse modèle.** C'est le mécanisme de FastAPI pour remplacer une dépendance pendant
les tests : `app.dependency_overrides[get_session] = ...`. Les routes restent inchangées,
mais reçoivent la session de test. C'est le bénéfice concret de l'injection de dépendances.

### Pourquoi deux lignes créées dans un même test ont-elles le même `created_at` ?

**Réponse modèle.** `now()` de PostgreSQL renvoie l'heure du **début de la transaction**,
pas de chaque instruction. Chaque test s'exécute dans une seule transaction (annulée à la
fin), donc toutes les lignes insérées par un test ont la même date. En production, chaque
requête a sa propre transaction, donc les dates diffèrent. Pour tester le départage par
`id` sans dépendre de ce détail, je fixe `created_at` à la main sur deux lignes identiques.

---

## IA

*(à compléter quand on ajoutera l'extraction d'offres par LLM : choix du modèle, sortie structurée, gestion des erreurs et des coûts, validation de la réponse du LLM)*

---

## Déploiement

*(à compléter plus tard : Docker, variables d'environnement en production, migrations au déploiement, CI)*
