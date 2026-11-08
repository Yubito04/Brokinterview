# ADR 004 — Migrations de schéma avec Alembic

- **Statut** : Accepté
- **Date** : 2026-11-08

## Contexte

Les tables n'existaient que dans le code (`models.py`). Il faut les créer dans
PostgreSQL, puis les faire évoluer sans perdre de données quand les modèles changent.

## Options envisagées

### Comment créer et faire évoluer le schéma ?
1. **`Base.metadata.create_all`** : crée les tables manquantes, mais ne sait pas
   modifier une table existante (ajouter une colonne, changer un type).
2. **Alembic** : des scripts de migration versionnés, appliqués dans l'ordre, avec
   un `upgrade` et un `downgrade`.

### Comment écrire la migration initiale ?
1. **Autogénérée puis relue** : rapide, et la relecture force à comprendre le schéma.
2. **Écrite à la main** : plus de contrôle, mais plus long et plus d'erreurs possibles.

### Les tests construisent-ils le schéma avec les migrations ?
1. **Oui** : tests et production ont le même schéma ; les migrations sont testées.
2. **Non (`create_all`)** : plus simple, mais un oubli de migration passerait inaperçu.

## Décision

- Alembic, avec une migration initiale autogénérée puis relue et corrigée.
- `alembic/env.py` lit `DATABASE_URL` depuis la configuration de l'application
  (aucun mot de passe dans `alembic.ini`). Les tests lui passent leur propre
  connexion (`config.attributes["connection"]`), donc ils ne touchent jamais à `applyflow`.
- Les tests repartent d'un schéma vide, appliquent les migrations, puis les annulent.
- Deux tests de garde dans `tests/test_migrations.py` :
  - `alembic check` échoue si un modèle a changé sans migration ;
  - un aller-retour `upgrade -> downgrade -> upgrade` vérifie aussi que le type enum
    PostgreSQL est supprimé.
- `compare_type=True` : un changement de type de colonne est détecté.

## Conséquences

- (+) Historique versionné du schéma, applicable sur n'importe quelle base.
- (+) Impossible d'oublier une migration sans que la suite échoue.
- (+) Les tests valident aussi les migrations elles-mêmes.
- (−) L'autogénération se trompe parfois : le `downgrade` généré ne supprimait pas
  le type enum `applicationstatus` (corrigé à la main avec `DROP TYPE`). Chaque
  migration doit être relue.
- (−) La suite est un peu plus lente (migrations à chaque exécution).
- (−) `reset_schema` supprime tout le schéma `public` de la base de test : il ne doit
  être appelé que sur elle, ce que le verrou de `db_safety.py` garantit.
- (−) `requirements.txt` est encodé en UTF-16 (hérité d'un export PowerShell) ;
  les diffs Git de ce fichier sont illisibles. À convertir en UTF-8 un jour.
