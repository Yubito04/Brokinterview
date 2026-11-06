# ApplyFlow AI — Instructions pour Claude Code

## Contexte
ApplyFlow AI est un tracker de candidatures avec extraction d'offres d'emploi par LLM.
C'est un projet de portfolio que je dois pouvoir présenter et défendre en entretien technique.
Je suis étudiant en fin de baccalauréat en informatique (niveau junior).

## Stack
- Backend : Python 3.15, FastAPI, Pydantic, SQLAlchemy, Alembic, PostgreSQL
- Frontend (plus tard) : React + TypeScript (Vite)
- Tests : pytest
- Environnement : Windows, venv dans backend/.venv
  (utiliser backend\.venv\Scripts\python.exe pour les commandes Python)

## Mode de collaboration
- Tu écris le code. Je n'écris pas de code moi-même.
- Mon objectif est de comprendre en profondeur chaque partie du projet
  et d'être capable de la justifier en entretien.
- C'est moi qui prends les décisions : tu proposes, j'approuve.
- Explications en français. Code, noms de variables et messages de commit en anglais.
- Explique le jargon technique la première fois qu'il apparaît.

## Avant chaque tâche
1. Reformule ce qu'on va construire et pourquoi.
2. S'il existe plusieurs approches, présente 2 ou 3 options avec leurs avantages
   et inconvénients, puis ta recommandation.
3. Attends ma validation avant d'écrire du code.

## Pendant la tâche
- Avance par petites étapes : une fonctionnalité à la fois.
- Écris du code simple et lisible, sans astuces inutiles.
  Je dois pouvoir l'expliquer ligne par ligne.
- Ajoute des commentaires uniquement là où le "pourquoi" n'est pas évident.
- Chaque fonctionnalité est accompagnée de tests pytest.

## Après chaque tâche
1. Explique le code produit : ce que fait chaque partie, pourquoi elle est écrite
   ainsi, et quelles alternatives ont été écartées.
2. Relie le code aux concepts généraux (REST, validation, ORM, injection
   de dépendances, etc.) pour que je puisse en parler hors de ce projet.
3. Donne-moi 3 questions qu'un recruteur pourrait poser sur cette partie,
   attends mes réponses, puis corrige-les.
4. Mets à jour la documentation (voir ci-dessous).
5. Propose un message de commit au format Conventional Commits
   (feat:, fix:, test:, docs:, refactor:, chore:).

## Documentation à maintenir
- docs/adr/ : un fichier par décision d'architecture
  (contexte, options envisagées, décision, conséquences).
- docs/learning-log.md : chaque concept appris, expliqué simplement,
  avec un exemple tiré du projet.
- docs/interview-prep.md : questions d'entretien probables et réponses modèles,
  classées par thème (architecture, API, base de données, IA, tests, déploiement).
- README.md : à jour avec l'architecture et les instructions de lancement.

## Règles de sécurité et de Git
- Aucune clé API ni secret dans le code : utiliser un fichier .env (ignoré par Git).
- Montre-moi git status et le diff avant chaque commit.
- Ne jamais faire de git push sans ma demande explicite.

## Si je ne comprends pas
Quand je dis "je ne comprends pas", réexplique avec une analogie concrète
et un exemple plus simple, sans jargon.