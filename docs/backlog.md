# Backlog

Pistes d'amélioration identifiées, pas encore réalisées.

## Extraction d'offres (ADR 006)

- **Signaler les compétences introuvables dans le texte source.** Comparer chaque élément de
  `skills` au texte de l'offre (par exemple une recherche insensible à la casse) et indiquer
  dans la réponse ceux qui n'y figurent pas, pour aider la relecture. Cela aurait signalé
  « Docker » dans l'évaluation initiale. Une comparaison littérale ratera les variantes
  d'écriture (« UNIX/Linux » contre « Linux ») : elle sert à alerter, pas à rejeter.

## Frontend (ADR 008)

- **Repasser à TypeScript 7.** Le projet est en TypeScript 5.9.3 car `openapi-typescript`
  7.13.0 exige TypeScript 5 et plante avec TypeScript 7. Quand une version compatible sort :
  mettre à jour les deux, puis relancer `npm run build`, `npm run lint` et `npm run check:api`.
  Contexte : [ADR 008](adr/008-choix-techniques-du-frontend.md), section « Piège rencontré :
  TypeScript 7 contre openapi-typescript ».

Contexte (extraction) : [ADR 006](adr/006-extraction-d-offres-par-llm.md), section « Évaluation réelle ».
