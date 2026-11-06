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

---

## API

### Que se passe-t-il si un client envoie `POST /applications` sans `company` ?

**Réponse modèle.** Pydantic valide le corps de la requête avant que ma fonction
ne s'exécute. Le champ obligatoire manque, donc FastAPI renvoie automatiquement
une erreur `422` avec le détail du champ fautif. Ma fonction n'est jamais appelée.

### Pourquoi `201` plutôt que `200` ? Différence entre GET et POST ?

**Réponse modèle.** `GET` lit une ressource sans la modifier. `POST` en crée une.
`201 Created` signale précisément qu'une ressource a été créée ; `200` dit seulement
que ça a marché.

### Pourquoi un endpoint `/health` ?

**Réponse modèle.** C'est un endpoint de supervision : Docker, un load balancer
ou un outil de déploiement l'appellent pour savoir si l'application est vivante.

### Qu'est-ce que la validation « aux frontières » ?

**Réponse modèle.** On vérifie les données dès leur entrée dans le système
(ici avec Pydantic), pour que le reste du code puisse supposer qu'elles sont valides.

---

## Base de données

### Où mets-tu le mot de passe de la base de données ?

**Réponse modèle.** Jamais dans le code. Il est dans un fichier `.env` ignoré par Git,
lu au démarrage par `pydantic-settings`. Je fournis un `.env.example` sans secret pour
documenter les variables attendues. Si la variable manque, l'application refuse de
démarrer au lieu de se connecter au mauvais endroit.

### Que fait `create_engine` ? Se connecte-t-il tout de suite ?

**Réponse modèle.** Il crée l'objet qui gère les connexions à la base (avec un pool de
connexions réutilisables). Il ne se connecte pas immédiatement : la connexion est
ouverte à la première requête.

### À compléter pendant l'étape B

- Qu'est-ce qu'un ORM, et quels sont ses avantages et limites ?
- Pourquoi deux modèles (Pydantic et SQLAlchemy) ?
- À quoi servent les migrations (Alembic) ?
- Qu'est-ce que l'injection de dépendances dans FastAPI ?

---

## IA

*(à compléter quand on ajoutera l'extraction d'offres par LLM)*

---

## Tests

### Comment testes-tu ton API ?

**Réponse modèle.** Avec pytest et le `TestClient` de FastAPI, qui appelle
l'application en mémoire sans serveur : les tests sont rapides. Je teste le cas
normal (statut par défaut `APPLIED`, statut explicite) et les cas d'erreur
(champ manquant → `422`).

---

## Déploiement

*(à compléter plus tard)*
