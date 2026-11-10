# Backlog

Pistes d'amélioration identifiées, pas encore réalisées.

## Extraction d'offres (ADR 006)

- **Signaler les compétences introuvables dans le texte source.** Comparer chaque élément de
  `skills` au texte de l'offre (par exemple une recherche insensible à la casse) et indiquer
  dans la réponse ceux qui n'y figurent pas, pour aider la relecture. Cela aurait signalé
  « Docker » dans l'évaluation initiale. Une comparaison littérale ratera les variantes
  d'écriture (« UNIX/Linux » contre « Linux ») : elle sert à alerter, pas à rejeter.

Contexte : [ADR 006](adr/006-extraction-d-offres-par-llm.md), section « Évaluation réelle ».
