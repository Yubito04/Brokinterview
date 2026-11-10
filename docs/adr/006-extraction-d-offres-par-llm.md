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

## Évaluation réelle (2026-11-10)

Quatre vraies offres ont été envoyées à l'endpoint avec le vrai modèle (RBC, Nuovo
Artistic Studios, deux textes d'Ericsson Canada). L'évaluation a été faite en comparant
chaque réponse au texte source de l'offre.

**Correction de l'évaluation initiale.** Elle concluait à l'absence d'hallucination. C'était
inexact : pour le second texte d'Ericsson, la première réponse listait « Docker » dans
`skills`, alors que ce mot n'apparaît pas dans l'offre (qui cite Kubernetes, Jenkins,
Spinnaker, Groovy, Linux et Git). L'évaluation initiale ne l'avait pas relevé. Docker a
disparu des réponses suivantes (une relance après les corrections, puis 3 relances) ; sa
disparition est donc une correction, mais rien ne la garantit : c'est une limite du modèle,
pas un bug corrigé. Les autres champs relevés étaient présents dans les textes.

Constats de l'évaluation initiale :

1. **RBC, deux dates.** Le texte donne une date (le 16) et une date officielle (le 17,
   avec fermeture la veille). Le modèle a retenu le 17. Ce choix est défendable mais il
   n'est pas garanti : une offre qui contient plusieurs dates est ambiguë.
2. **Nuovo, compétences mélangées.** `skills` contenait des compétences techniques (Python,
   Git) et des pratiques ou activités (revues de code, documentation, tests, design UI/UX).
   Cela rendait la liste peu utilisable.
3. **Ericsson, `position` à `null`.** Sur un des textes, `position` est revenu à `null`
   alors que l'autre texte donnait « Développeur de logiciels ». Ce constat avait d'abord
   été rattaché à l'injection contenue dans l'un des deux textes. **Ce lien n'est pas
   démontré** : le texte sans injection a lui aussi donné `position = null` à une relance
   (voir « Variabilité »). Cause non établie : l'injection n'est pas écartée, mais rien ne
   la prouve.

### Corrections apportées

- **Le prompt** précise que `skills` ne contient que des compétences techniques (langages,
  frameworks, bibliothèques, outils, bases de données, plateformes), sans pratiques,
  activités ni qualités personnelles.
- **`skills` vaut `[]` quand rien n'est trouvé**, et non plus `null`. Le champ du schéma
  passe de `list[str] | None` à `list[str]`. Pour une liste, « aucune » et « liste vide »
  sont la même chose : le client n'a plus qu'un seul cas à gérer. Les quatre autres champs
  gardent `null` pour « absent de l'offre » (cela corrige la phrase « tous peuvent être
  `null` » de la décision initiale, qui ne vaut plus pour `skills`).
- Un test réel (`live_llm`) vérifie que les pratiques ne reviennent pas dans `skills`. Il
  peut échouer de temps en temps à cause du non-déterminisme du modèle : un échec doit être
  examiné avant d'être considéré comme un bug.

### Variabilité mesurée

Après les corrections, chaque offre a été envoyée 3 fois (modèle et prompt inchangés).

| Champ | Nuovo | Ericsson (1) | Ericsson (2) | RBC |
|---|---|---|---|---|
| `company` | 3/3 | 3/3 | 3/3 | 3/3 |
| `position` | 3/3 | 1/3 | 2/3 | 2/3 |
| `location` | 3/3 | 3/3 | 3/3 | 3/3 |
| `deadline` | 3/3 | 3/3 | 3/3 | 3/3 |
| `skills` | 3/3 | 3/3 | 3/3 | 2/3 |

Chiffres : nombre d'exécutions (sur 3) qui donnent la valeur la plus fréquente. Les
différences sur `position` sont tantôt un `null`, tantôt une reformulation
(« Développeur de logiciels » / « développeurs de logiciels »), tantôt un autre titre (RBC).
Pour RBC, `UNIX/Linux` et `Windows` (présents dans le texte : « UNIX/Linux ou Windows »)
manquent dans 1 exécution sur 3 : ils ne disparaissent donc pas systématiquement. Chaque
compétence renvoyée figurait dans le texte (vérification automatique, sur les 3 exécutions).

### Pas de réglage de la température

L'appel au modèle ne définit pas de `temperature`. Elle ne peut pas être abaissée : le SDK
installé (anthropic 2.6.0) n'a plus ce paramètre dans `messages.create()`, et l'API
refuse la valeur envoyée à la main (`400 : temperature: Extra inputs are not permitted`,
vérifié le 2026-11-10 avec `claude-haiku-5-5`). La variabilité se réduit autrement
(prompt plus précis, validation, vérification humaine), pas par ce réglage.

### Limites connues, non corrigées

- **Dates multiples** (RBC) : le modèle choisit une date, sans signaler l'ambiguïté. Le
  client doit vérifier la date avant de créer la candidature.
- **`position` instable** : le même texte donne `null`, une reformulation ou un autre
  titre d'une exécution à l'autre. Les champs sont à vérifier, ce qui justifie que
  l'endpoint ne sauvegarde rien.
- **Hallucination possible** : « Docker » a été inventé une fois. Un contrôle côté serveur
  (rejeter une compétence absente du texte) n'existe pas.
- **Injection** : une attaque peut échouer tout en dégradant l'extraction ; ce n'est pas
  démontré ici (voir constat 3).
- Quatre offres, trois passages chacune : échantillon trop petit pour mesurer un taux de
  réussite.

### Conclusion

L'instabilité de `position` apparaît là où le texte source est ambigu. Les textes d'Ericsson
n'ont aucun titre explicite (ils disent seulement « nous recherchons des développeurs de
logiciels »), et celui de RBC en contient deux (« développeur, Marchés de capitaux,
Services technologiques et quantitatifs » et « stagiaire des Services technologiques et
quantitatifs »). Nuovo, dont le titre est clair (« Software Developer Intern »), est stable
sur les 3 exécutions (et sur les 5 passages depuis le début). Quand le texte ne tranche pas,
le modèle tranche différemment d'un appel à l'autre. Cette lecture colle aux 12 réponses
observées, mais l'échantillon est trop petit pour en faire une règle.

## Backlog

Les pistes d'amélioration issues de cette évaluation sont dans [`docs/backlog.md`](../backlog.md).
