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

---

## Prochaines notions

- Pagination et filtres sur `GET /applications` (statut, recherche).
- Extraction d'offres d'emploi par LLM (partie « IA » du projet).
