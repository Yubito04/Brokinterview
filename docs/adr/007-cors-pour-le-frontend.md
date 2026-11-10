# ADR 007 — Autoriser le frontend à appeler l'API (CORS)

- **Statut** : Accepté
- **Date** : 2026-11-10

## Contexte

Le frontend (React, Vite) tourne sur `http://localhost:5173` et l'API sur
`http://127.0.0.1:8765`. Pour un navigateur, ce sont deux **origines** différentes (une
origine = protocole + nom d'hôte + port). Par sécurité, le navigateur envoie la requête
mais refuse de donner la réponse à la page, sauf si le serveur l'autorise par des
en-têtes HTTP : c'est le CORS (*Cross-Origin Resource Sharing*).

Les requêtes avec un corps JSON, `PATCH` ou `DELETE` sont précédées d'une requête de
vérification (`OPTIONS`, le *preflight*) : « cette origine a-t-elle le droit ? ».

## Options envisagées

1. **`CORSMiddleware` de FastAPI** avec une liste d'origines autorisées. Même mécanisme en
   développement et en production.
2. **Proxy du serveur de développement Vite** : les appels `/api/...` sont transmis à
   l'API, le navigateur ne voit qu'une origine et n'a pas besoin de CORS. Mais le problème
   revient au déploiement, et on ne teste pas ce qui tournera en production.
3. **Autoriser toutes les origines (`*`)** : rapide, mais n'importe quel site pourrait lire
   les réponses de l'API depuis le navigateur d'un utilisateur.

## Décision

- Option 1. `CORSMiddleware` dans `app/main.py`, avec les méthodes `GET`, `POST`, `PATCH`,
  `DELETE` et l'en-tête `Content-Type`.
- La liste des origines vient du réglage `CORS_ORIGINS` (`.env`, valeurs séparées par des
  virgules). Valeur par défaut : `http://localhost:5173` **et** `http://127.0.0.1:5173`.
  Les deux sont nécessaires : `localhost` et `127.0.0.1` sont des noms d'hôte différents,
  donc des origines différentes, et on ouvre le frontend avec l'un ou l'autre.
- Pas de `*`. Pas de cookies ni d'identifiants (`allow_credentials` reste désactivé) : l'API
  n'a pas d'authentification pour l'instant.

## Conséquences

- (+) Le frontend peut appeler l'API en développement comme en production : il suffit de
  changer `CORS_ORIGINS`.
- (+) Les origines inconnues ne reçoivent pas l'en-tête d'autorisation (test automatique).
- (−) **CORS ne protège pas l'API.** Il protège l'utilisateur d'un navigateur contre une page
  malveillante. Un script, `curl` ou un autre serveur appelle l'API sans aucune restriction :
  il faudra une authentification et une limitation de débit avant un déploiement public
  (voir ADR 006).
- (−) **À prévoir avec l'authentification** : quand l'API exigera un jeton, le frontend enverra
  l'en-tête `Authorization`. Il faudra alors l'ajouter à `allow_headers` (aujourd'hui seulement
  `Content-Type`), sinon le preflight échouera et le navigateur bloquera toutes les requêtes.
  Si l'authentification passe par des cookies, il faudra en plus activer `allow_credentials`
  et lister des origines précises (jamais `*`).
- (−) Une requête refusée ne produit pas d'erreur côté serveur : c'est le navigateur qui
  bloque et affiche une erreur dans sa console. Le débogage se fait donc côté navigateur.
