# ADR 003 — Stratégie de tests avec la base de données

- **Statut** : Accepté
- **Date** : 2026-11-08

## Contexte

Les routes lisent et écrivent dans PostgreSQL. Il faut les tester, sans jamais
risquer de toucher aux vraies candidatures de la base de développement, et avec des
tests qui ne dépendent pas les uns des autres.

## Options envisagées

### Quelle base pour les tests ?
1. **SQLite en mémoire** : rapide, sans serveur, mais différent de PostgreSQL.
2. **Base PostgreSQL de test séparée** : fidèle à la production, mais demande un
   serveur qui tourne.

### Comment isoler les tests ?
1. **Vider les tables après chaque test** : plus lent ; un test qui plante peut
   laisser des données.
2. **Recréer les tables à chaque test** : très lent.
3. **Transaction annulée (rollback) à la fin de chaque test** : rapide, et la base
   revient toujours à l'état vide.

## Décision

- Base PostgreSQL de test séparée (`applyflow_test`), choisie par moi.
- Tables créées une fois par session de tests (`create_all`), supprimées à la fin.
- Chaque test s'exécute dans une transaction externe annulée à la fin. La session
  est liée à la connexion avec `join_transaction_mode="create_savepoint"` : les
  `commit()` des routes ne valident qu'un point de sauvegarde, pas la transaction.
- L'application est détournée avec `app.dependency_overrides[get_session]`, sans
  modifier aucune route.
- Un verrou (`tests/db_safety.py`, appelé dans `pytest_sessionstart`) arrête tout
  avant la moindre opération si `TEST_DATABASE_URL` est absent, si le nom de la base
  ne finit pas par `_test`, ou si elle est identique à `DATABASE_URL`.

## Conséquences

- (+) Tests fidèles à la production (types, contraintes, enum PostgreSQL).
- (+) Isolation rapide et fiable, même si un test échoue.
- (+) Une faute de configuration ne peut pas détruire les données de développement.
- (−) PostgreSQL doit tourner pour lancer la suite.
- (−) Les `id` auto-incrémentés ne reviennent pas à 1 après un rollback : aucun test
  ne doit supposer un `id` précis.
- (−) Le verrou vérifie le nom de la base, pas son contenu. En entreprise, on
  ajouterait un utilisateur PostgreSQL limité à la base de test.
- (−) Les tables étaient d'abord créées par `create_all`. **Mis à jour dans
  l'ADR 004** : les tests utilisent maintenant les migrations Alembic.
