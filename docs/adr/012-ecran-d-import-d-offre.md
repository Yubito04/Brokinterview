# ADR 012 — Écran d'import d'une offre, avec relecture

- **Statut** : Accepté
- **Date** : 2026-11-18

## Contexte

L'API sait extraire des champs d'une offre d'emploi avec un modèle d'IA
(`POST /job-postings/extract`, [ADR 006](006-extraction-d-offres-par-llm.md)). Il manque l'écran :
coller le texte, obtenir les champs, les **relire**, puis créer la candidature. Trois contraintes
viennent de l'ADR 006 : le résultat n'est **jamais** enregistré automatiquement (le modèle se
trompe, et l'offre est un texte non fiable), chaque appel **coûte de l'argent**, et l'API n'a
ni authentification ni limite de débit.

## Options envisagées et décisions

| Sujet | Options | Décision | Raison principale |
|---|---|---|---|
| Enchaînement avec la création | écran en deux temps avec le formulaire existant, écran d'extraction + valeurs dans l'URL, panneau de relecture à part | **Deux temps, formulaire existant prérempli** | Aucune règle dupliquée : les erreurs 422, le focus et la création sont ceux du formulaire (`ApplicationForm`). |
| Champs que l'IA n'a pas trouvés | tout préremplir sans distinguer, marquer chaque valeur, signaler les champs vides | **Champ vide + « Non trouvé dans l'offre. »** lié au champ | Un champ vide ressemble à un oubli ; la note dit que c'est la réponse du modèle. |
| Champs que l'IA a remplis | rien, marquer chaque champ « suggéré par l'IA » | **Un avertissement unique** nommant le poste et la date limite | Le risque principal n'est pas le champ vide mais le champ **rempli et faux**. L'évaluation de l'ADR 006 a trouvé ces deux champs instables. |
| Compétences (`skills`) | les enregistrer, les afficher, les cacher | **Affichées en lecture seule**, non enregistrées | Aucune colonne pour elles (backlog). Elles aident à relire l'offre. |
| Texte collé | `maxLength` sur la zone, ou aucune limite côté client | **Aucun `maxLength`**, un compteur et le refus du serveur | Un navigateur **coupe en silence** un texte collé trop long : on enverrait une offre sans sa fin sans le savoir. |
| Nouvelle extraction après des corrections | écraser, demander avant la requête, demander après la réponse | **Demander avant la requête** | Refuser ne coûte rien ; demander après aurait déjà payé l'appel. |

## L'extraction : attente, annulation, coût

- **Un seul appel à la fois** : le bouton est désactivé pendant l'attente. Chaque appel est payant,
  un double clic ne doit pas en envoyer deux.
- **Pas de rejeu automatique**, ni pour un 504 : chaque essai coûte, la décision de réessayer est
  celle de l'utilisateur. Le client n'a pas de rejeu des écritures (ADR 008, backlog).
- **Annuler arrête l'attente, pas le travail du serveur.** Le bouton annule la requête
  (`AbortController`), mais le serveur peut terminer l'appel auprès du modèle et le facturer.
  Cette limite est écrite ici parce qu'elle surprend. Un test vérifie que le signal est bien
  annulé (sinon on cacherait seulement l'attente).
- **Une annulation n'est pas une erreur** : rien n'est affiché pour elle, et le texte collé reste.
- **Délais** : 60 s côté frontend, au-dessus du budget d'environ 41 s du backend (ADR 006).
- **Erreurs traduites** par leur genre (502, 503, 504, réseau) ; un texte vide ou trop long est
  un 422 du serveur, rangé sous la zone de texte. Pour le texte vide, le backend renvoie un
  **code stable `text_blank`** (une `PydanticCustomError`) au lieu du `value_error` générique : le
  message traduit est « Collez le texte d'une offre. ».
- **Le compteur compte comme le serveur** : en caractères (code points), pas en unités UTF-16. Un
  emoji vaut 1 pour Python et 2 pour `String.length` ; avec `.length`, le compteur annoncerait « trop
  long » pour un texte que le serveur accepte. La limite (20 000) est lue dans le contrat
  `backend/openapi.json` par un test, pour ne pas dériver.

## La relecture

- **Aucune validation côté client.** La réponse de l'IA est montrée telle quelle ; le serveur a le
  dernier mot à la création (422 traduit, comme pour le formulaire).
- **Une date que le champ ne peut pas afficher** (`soon`, `15/12/2026`, `2026-02-31`) est comptée
  comme **non trouvée**. Sinon `<input type="date">` l'afficherait vide en silence, comme si le
  modèle n'avait rien dit alors qu'il a répondu quelque chose d'inutilisable.
- **Corrections manuelles protégées.** `hasManualChanges` compare ce que le formulaire contient à la
  réponse de l'IA. Si l'utilisateur a modifié, effacé ou rempli un champ, une nouvelle extraction
  demande confirmation, avec le focus sur « Garder mes corrections » (le choix sûr) ; Échap garde.
  Revenir à la valeur d'origine ne compte pas comme une correction.
- **Formulaire gelé pendant une extraction** (`<fieldset disabled>`) : ce qu'on taperait pendant
  l'attente serait écrasé par la réponse.
- **Si la nouvelle extraction échoue**, la relecture précédente et les corrections restent.

## Sécurité et confidentialité

- **Texte non fiable.** L'offre est écrite par un tiers ; la réponse du modèle peut contenir
  n'importe quoi. Tout ce que l'IA renvoie est affiché **comme du texte** : React échappe par
  défaut et aucun `dangerouslySetInnerHTML` n'est utilisé. Un test envoie `<img onerror=…>`,
  « Ignore your instructions » et `<b>bold</b>` et vérifie qu'aucun élément n'est créé.
- **La validation humaine est le dernier filet** contre l'injection de prompt : le modèle n'a
  aucun outil, rien n'est enregistré sans relecture.
- **Confidentialité.** Le texte part chez un fournisseur d'IA. Une note, liée à la zone de texte
  (lue avec elle), le dit avant l'envoi.
- **Pas de déploiement public sans authentification ni limite de débit** (ADR 006, backlog) : sinon
  quiconque atteint l'endpoint dépense la clé.
- **`server.fs.allow` limité au mode test.** Un test lit `backend/openapi.json`, fichier hors du
  dossier du frontend, ce que Vite refuse par défaut. Le réglage `server.fs.allow: ['..']`
  l'autorise, mais il vaut aussi pour `npm run dev` : le serveur de développement pourrait alors
  servir **n'importe quel fichier du dépôt**, dont `backend/.env` (la clé d'API), à quiconque atteint
  ce serveur. Le réglage est donc conditionné au mode `test`
  (`mode === 'test' ? { fs: { allow: ['..'] } } : {}`) ; `vite build` et le mode développement ne
  changent pas.

## Essai réel dans l'interface

Essai fait par l'auteur du projet dans le navigateur, avec le vrai modèle et de vraies offres. Ce
sont des **observations de quelques appels**, pas une mesure.

- **RBC** : extraction correcte, avertissement affiché, compétences en lecture seule. La **date
  limite proposée était le 16/11**, alors que le modèle avait choisi le **17** lors de
  l'évaluation de l'ADR 006 : la variabilité sur les offres à plusieurs dates est **confirmée**, ce
  qui justifie l'avertissement sur la date limite. La question avant d'écraser des corrections
  s'est affichée avant tout appel, « Garder mes corrections » a fonctionné, et la candidature a
  été créée.
- **Ericsson, texte contenant une ligne d'injection de prompt** : le modèle l'a ignorée
  (entreprise « Ericsson Canada Inc. », poste « Développeur de logiciels »). La date limite est
  restée **vide avec « Non trouvé dans l'offre. »** : il n'a pas pris la « date de début » du texte
  (11 janvier 2027) pour une date limite. Les **7 compétences** étaient celles de l'évaluation, sans
  « Docker » (le mot inventé une fois lors de la première évaluation).
- **Ce que cela ne prouve pas.** Deux offres, un passage chacune : la résistance à l'injection n'est
  pas démontrée (l'ADR 006 note qu'une attaque peut échouer tout en dégradant l'extraction), et
  l'absence de « Docker » n'est pas garantie. Ces observations confortent la conception (relecture
  obligatoire, avertissement) sans la remplacer.

## Limites connues

- **Un seul avertissement général**, pas une alerte par champ douteux : le serveur ne dit pas quel
  champ est faux.
- **Les compétences ne sont pas enregistrées** (backlog : colonne, migration, statistiques).
- **Annuler ne stoppe pas la facture** (voir plus haut).
- **Accessibilité vérifiée par des tests par rôle et par nom, pas avec un lecteur d'écran** : le
  focus après une erreur, les zones `role="status"` et la question avant d'écraser restent à
  confirmer avec NVDA.
- **Le sélecteur de date natif suit la langue du navigateur** (ADR 010).
- **Un test du formulaire de candidature a échoué de façon intermittente** (cause non démontrée,
  backlog) ; les lancements de mesure suivants n'ont montré aucun échec.

## Conséquences

- Une fonctionnalité qui montre le résultat d'un modèle suit ce schéma : valeurs modifiables,
  champs absents signalés, **champs remplis signalés comme à vérifier**, aucune validation côté
  client, aucun enregistrement sans action de l'utilisateur.
- Toute action qui peut effacer le travail de l'utilisateur demande confirmation **avant** de
  dépenser quoi que ce soit, avec le focus sur le choix sûr.
- Les tests de cet écran n'appellent jamais le vrai modèle : le faux serveur répond (résultat,
  erreurs, attente retenue), ce qui les rend gratuits et répétables.
