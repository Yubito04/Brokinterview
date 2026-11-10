# ADR 006 — Extraction d'offres d'emploi par LLM (`POST /job-postings/extract`)

- **Statut** : Accepté
- **Date** : 2026-11-10

## Contexte

Créer une candidature à la main oblige à recopier l'entreprise, le poste, le lieu et la
date limite depuis une offre. On veut coller le texte d'une offre et obtenir ces champs
pré-remplis. Un LLM (grand modèle de langage) sait lire un texte libre et en tirer des
champs, ce qu'une expression régulière ferait mal car les offres n'ont aucun format commun.

## Options envisagées

### Comment obtenir des champs fiables du modèle
1. **Demander du JSON dans le prompt et le parser nous-mêmes** : simple, mais le modèle
   peut ajouter du texte autour, oublier un champ ou changer un type.
2. **Sortie structurée du SDK** (`messages.parse` avec une classe Pydantic) : la classe
   devient un schéma JSON que la réponse doit suivre, et le SDK la valide.
3. **Tool use** (faire « appeler un outil » au modèle pour récupérer les arguments) :
   marche aussi, mais détourne un mécanisme pensé pour autre chose.

### Quel modèle
1. **Un grand modèle** : meilleur sur les cas difficiles, plus cher et plus lent.
2. **Claude Haiku** : le plus petit, rapide et peu coûteux. Lire une offre et en extraire
   cinq champs est une tâche facile.

### Où brancher l'appel au modèle
1. **Appeler le SDK directement dans la route** : court, mais chaque test coûterait de
   l'argent et dépendrait du réseau.
2. **Une interface `JobExtractor` injectée avec `Depends`** : la route ne connaît que
   « un objet qui sait extraire ». En production c'est l'implémentation Anthropic ; en
   test, un faux.

### Que fait l'endpoint du résultat
1. **Créer la candidature directement** : un clic de moins, mais une erreur du modèle
   est enregistrée sans que personne la voie.
2. **Renvoyer les champs sans rien sauvegarder** : l'utilisateur vérifie, puis appelle
   `POST /applications` lui-même.

## Décision

- **Sortie structurée** via `client.messages.parse(..., output_format=ExtractedJob)`.
  `ExtractedJob` a cinq champs : `company`, `position`, `location`, `deadline` et
  `skills`. **Tous peuvent être `null`** : « absent de l'offre » est une réponse valide et
  vaut mieux qu'une invention. Le prompt système le dit explicitement.
- **Modèle** : `claude-haiku-5-5`, configurable par `ANTHROPIC_MODEL`. `effort: "low"`
  garde l'appel rapide et peu coûteux.
- **Date du jour** donnée dans le message utilisateur, pour que le modèle puisse résoudre
  « avant le 15 décembre » ou « dans deux semaines » en date ISO.
- **Offre = donnée non fiable.** Elle est écrite par un tiers et peut contenir « ignore
  tes instructions… » (injection de prompt). Le texte est placé entre balises
  `<job_posting>` et le prompt système interdit de suivre ses instructions. Cela réduit le
  risque sans le supprimer, d'où la décision suivante : **le résultat n'est jamais
  sauvegardé automatiquement**, et le modèle n'a accès à aucun outil ni aucune donnée.
- **Interface `JobExtractor`** (un `Protocol`) et dépendance `get_job_extractor`. Les tests
  la remplacent par un faux avec `dependency_overrides`.
- **Erreurs** : sans clé API, `503` (le service n'est pas configuré). Si l'appel échoue
  (réseau, limite de débit, mauvaise clé, refus, `max_tokens`, réponse hors schéma), `502`
  (notre serveur va bien, le service amont a échoué). Le détail reste dans les logs, il
  n'est jamais renvoyé au client.
- **Coût borné** : texte limité à 20 000 caractères (`422` au-delà, ou si vide),
  `max_tokens=4096`, `timeout=30 s`, `max_retries=2`.
- **Clé optionnelle** : sans `ANTHROPIC_API_KEY`, l'application démarre quand même ; seul
  cet endpoint répond `503`. La clé est passée explicitement au client, car
  pydantic-settings lit `.env` sans remplir `os.environ`.
- **Rien n'est sauvegardé** par l'endpoint. `skills` est renvoyé mais n'est pas stocké :
  il n'y a pas encore de colonne pour lui.

## Conséquences

- (+) Réponse toujours conforme au schéma, ou une erreur claire.
- (+) Tests gratuits, rapides et répétables (faux extracteur, couche HTTP simulée). Deux
  tests marqués `live_llm` appellent le vrai modèle et ne tournent que sur demande
  (`pytest -m live_llm`).
- (+) Changer de modèle ou de fournisseur ne touche ni la route ni ses tests.
- (−) Chaque appel coûte de l'argent et dépend d'un service externe : latence et pannes.
- (−) Un petit modèle peut se tromper (mauvais lieu, entreprise confondue avec un
  client) : d'où la vérification humaine avant la création.
- (−) Pas d'authentification ni de limitation de débit : quiconque atteint l'endpoint
  peut dépenser la clé. À ajouter avant tout déploiement public.
- (−) La défense contre l'injection de prompt est une atténuation, pas une garantie.
