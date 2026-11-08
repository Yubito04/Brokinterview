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
