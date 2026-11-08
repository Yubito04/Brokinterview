# ADR 005 — Pagination, filtres et tri de `GET /applications`

- **Statut** : Accepté
- **Date** : 2026-11-08

## Contexte

`GET /applications` renvoyait toutes les lignes. Avec beaucoup de candidatures, la
réponse deviendrait lourde et lente. Il faut découper en pages, filtrer, et garder un
ordre prévisible.

## Options envisagées

### Style de pagination
1. **`limit` + `offset`** : simple, saut direct à n'importe quelle page. Un grand
   `offset` est lent, et des lignes ajoutées pendant la navigation peuvent décaler les pages.
2. **`page` + `page_size`** : même mécanisme avec un autre vocabulaire, qui cache le calcul.
3. **Curseur (`after_id`)** : rapide à toute profondeur et stable, mais plus complexe et
   sans saut direct à une page.

### Forme de la réponse
1. **Liste simple** : rien ne change, mais le client ignore le total.
2. **Enveloppe** `{items, total, limit, offset}` : le client peut construire la navigation,
   au prix d'un `COUNT` et d'un format cassant.

### Filtres et tri
- Minimal : `status` seulement.
- Utile : `status`, `q` (recherche partielle), tri fixe.
- Complet : en plus un tri configurable (liste blanche de colonnes à gérer).

## Décision

- `limit` + `offset`. `limit` : 20 par défaut, entre 1 et 100 ; `offset` ≥ 0.
  Hors limites ou non numérique : `422`.
- Réponse en enveloppe. Le `total` compte les lignes filtrées (mêmes filtres, sans pagination).
- Filtres : `status` (valeur de l'enum, sinon `422`) et `q` (recherche `ILIKE`
  insensible à la casse sur l'entreprise **ou** le poste, `max_length=200`).
  Un `q` vide ou fait d'espaces est ignoré.
- Les caractères `\`, `%` et `_` de `q` sont échappés : le texte est cherché littéralement.
  C'est distinct de l'injection SQL, déjà évitée par les paramètres liés.
- Tri fixe : `created_at` décroissant, puis `id` décroissant. `id` est unique, donc l'ordre
  est totalement déterministe et deux pages ne peuvent ni se chevaucher ni sauter une ligne.

## Conséquences

- (+) Réponses bornées, navigation possible, ordre prévisible.
- (+) Le format change avant l'existence de tout client : coût nul aujourd'hui.
- (−) Un `COUNT` supplémentaire à chaque appel.
- (−) `offset` devient lent sur de très grandes tables ; on passerait alors au curseur.
- (−) `ILIKE '%texte%'` ne peut pas utiliser un index B-tree : un index `pg_trgm`
  serait nécessaire si la table grossit.
- (−) Pas de tri configurable pour l'instant.
