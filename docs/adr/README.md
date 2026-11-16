# Décisions d'architecture (ADR)

Un fichier par décision : contexte, options envisagées, décision, conséquences. Les ADR sont
numérotés dans l'ordre où les décisions ont été prises. Un ADR « accepté » peut recevoir des sections
datées (mesures, corrections) : l'ADR 006 en contient plusieurs.

| N° | Décision | Statut | Date |
|----|----------|--------|------|
| [001](001-choix-fastapi.md) | Choix de FastAPI pour le backend | Accepté | 2026-11-05 |
| [002](002-modele-application-contact.md) | Modèle de données Application / Contact | Accepté | 2026-11-06 |
| [003](003-strategie-de-tests-base-de-donnees.md) | Stratégie de tests avec la base de données | Accepté | 2026-11-08 |
| [004](004-migrations-alembic.md) | Migrations de schéma avec Alembic | Accepté | 2026-11-08 |
| [005](005-pagination-et-filtres.md) | Pagination, filtres et tri de `GET /applications` | Accepté | 2026-11-08 |
| [006](006-extraction-d-offres-par-llm.md) | Extraction d'offres d'emploi par LLM (avec l'évaluation sur de vraies offres) | Accepté | 2026-11-10 |
| [007](007-cors-pour-le-frontend.md) | Autoriser le frontend à appeler l'API (CORS) | Accepté | 2026-11-10 |
| [008](008-choix-techniques-du-frontend.md) | Choix techniques du frontend | Accepté | 2026-11-10 |
| [009](009-interface-bilingue-i18n.md) | Interface bilingue (français et anglais) | Accepté | 2026-11-16 |
| [010](010-formulaire-de-candidature.md) | Formulaire de création et de modification d'une candidature | Accepté | 2026-11-16 |
| [011](011-detail-contacts-et-suppression.md) | Page de détail, contacts et suppression | Accepté | 2026-11-17 |
| [012](012-ecran-d-import-d-offre.md) | Écran d'import d'une offre, avec relecture | Accepté | 2026-11-18 |
| [013](013-deploiement-et-securite.md) | Authentification, limitation d'appels et déploiement | **Proposé** (pas encore décidé) | 2026-11-18 |

## Par thème

- **Backend et base de données** : 001, 002, 003, 004, 005.
- **IA** : 006 (puis 012 pour l'écran).
- **Frontend** : 007, 008, 009, 010, 011, 012.
- **Sécurité et déploiement** : 007 (CORS), 006 (coût et injection), 013 (proposé).

## Ajouter un ADR

Copier la structure d'un ADR existant (Statut, Date, Contexte, Options envisagées, Décision,
Conséquences), prendre le numéro suivant et ajouter une ligne au tableau ci-dessus. Statuts utilisés :
**Proposé** (en discussion), **Accepté**, **Remplacé par NNN**.
