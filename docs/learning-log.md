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

---

## Prochaines notions (étape B : base de données)

- ORM (SQLAlchemy) : traduit des objets Python en lignes de table.
- Deux modèles distincts : modèle Pydantic (ce que l'API accepte) et modèle SQLAlchemy (la table).
- Injection de dépendances de FastAPI (`Depends`) pour fournir une session de base de données.
- Migrations (Alembic) : historique versionné des changements de schéma.
