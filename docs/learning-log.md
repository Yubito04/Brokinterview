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

---

## Prochaines notions

- Injection de dépendances de FastAPI (`Depends`) pour fournir une session de base de données.
- Deux modèles distincts : modèle Pydantic (ce que l'API accepte) et modèle SQLAlchemy (la table).
- Migrations (Alembic) : historique versionné des changements de schéma.
