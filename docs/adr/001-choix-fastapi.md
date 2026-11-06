# ADR 001 — Choix de FastAPI pour le backend

- **Statut** : Accepté
- **Date** : 2026-11-05

## Contexte

ApplyFlow AI est un projet de portfolio. Mes projets universitaires démontrent déjà
ma maîtrise de Java (notamment avec Spring Boot). Je veux que ce projet diversifie
mon portfolio en montrant une autre stack backend, tout en gardant un backend REST
moderne et typé.

## Options envisagées

1. **Spring Boot (Java)** : écosystème très mature, très répandu en entreprise.
   Mais il ne montre rien de nouveau par rapport à mes projets existants.
2. **FastAPI (Python)** : validation intégrée via Pydantic, documentation OpenAPI
   générée automatiquement, peu de code répétitif. Python est aussi le langage
   le plus courant pour l'intégration de LLM, ce qui sert la partie « IA » du projet.
3. **Django / Flask (Python)** : Django est plus complet mais plus lourd et
   orienté monolithe ; Flask est plus minimal mais sans validation ni documentation
   automatiques.

## Décision

Utiliser **FastAPI** pour le backend.

## Conséquences

- (+) Portfolio plus varié : Java d'un côté, Python de l'autre.
- (+) Validation des données et documentation `/docs` quasi gratuites.
- (+) Cohérent avec l'extraction d'offres par LLM (écosystème Python).
- (−) Je dois apprendre l'écosystème Python backend (SQLAlchemy, Alembic, venv).
- (−) Moins de structure imposée que Spring Boot : il faudra définir moi-même
  l'organisation du code (routes, services, accès aux données).
