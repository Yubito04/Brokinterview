# ADR 002 — Modèle de données Application / Contact

- **Statut** : Accepté
- **Date** : 2026-11-06

## Contexte

L'application suit des candidatures. Pour chacune, je veux aussi suivre les personnes
contactées (recruteurs, responsables techniques) : quand je les ai contactées et si
elles ont répondu. Trois questions de conception se posent :
comment stocker les contacts, comment représenter le statut d'une candidature,
et comment représenter l'état d'un contact.

## Options envisagées

### Stockage des contacts

1. **Colonnes dans `applications`** (`contact_name`, `contacted_at`...) : simple,
   mais limité à un seul contact par candidature.
2. **Table `contacts` séparée**, liée par une clé étrangère `application_id` :
   relation un-à-plusieurs, nombre de contacts illimité.

### Statut de la candidature

1. **Texte libre** : flexible, mais une faute de frappe est stockée en silence.
2. **Enum** (`APPLIED`, `INTERVIEW`, `OFFER`, `REJECTED`) : valeurs contrôlées.

### État d'un contact

- (a) **Colonne `state` stockée** : facile à filtrer en SQL, mais redondante avec les
  dates et pouvant les contredire.
- (b) **État déduit des dates** `contacted_at` / `replied_at` (propriété Python) :
  une seule source de vérité.

## Décision

- Table `contacts` séparée (option 2), avec `cascade="all, delete-orphan"` pour que
  les contacts suivent le sort de leur candidature.
- Statut de candidature en enum.
- État du contact déduit des dates (option b) : `REPLIED` si `replied_at` existe,
  sinon `WAITING` si `contacted_at` existe, sinon `NOT_CONTACTED`.
- `created_at` rempli par la base (`server_default=func.now()`).
- Le modèle `Contact` est créé avant Alembic, pour n'avoir qu'une seule migration initiale.

## Conséquences

- (+) Un nombre illimité de contacts par candidature, chacun avec son historique.
- (+) Pas d'incohérence possible entre l'état d'un contact et ses dates.
- (+) Les statuts invalides sont refusés.
- (−) Une jointure est nécessaire pour lire une candidature avec ses contacts.
- (−) Filtrer par état de contact en SQL demande d'écrire la condition sur les dates.
- (−) Ajouter un statut d'enum demandera une migration.
