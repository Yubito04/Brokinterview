# ADR 010 — Formulaire de création et de modification d'une candidature

- **Statut** : Accepté
- **Date** : 2026-11-16

## Contexte

L'écran liste existe ; il faut pouvoir créer et modifier une candidature. Le formulaire est
bilingue dès le départ ([ADR 009](009-interface-bilingue-i18n.md)) et doit afficher les erreurs
422 de l'API sous chaque champ, traduites.

## Options envisagées et décisions

| Sujet | Options | Décision | Raison principale |
|---|---|---|---|
| Où vit le formulaire | pages dédiées, fenêtre modale, ligne éditable | **Pages dédiées** (`/applications/new`, `/applications/:id/edit`) | Une URL par écran : lien partageable, bouton « retour » qui fonctionne, et la page de détail (étape 6) s'y raccorde. Pas de gestion du focus d'une fenêtre à écrire. |
| État du formulaire | `useState`, react-hook-form, champs non contrôlés + `FormData` | **`useState`** | Cinq champs : aucune dépendance, et chaque ligne s'explique. |
| Validation côté client | règles dupliquées en TypeScript, aucune | **Aucune règle** : le serveur décide | Une seule source de règles (l'API) : le formulaire et le serveur ne peuvent pas diverger. |
| Envoi | `useMutation`, `fetch` direct dans le composant | **`useMutation`**, sans rejeu | Un `POST` rejoué créerait un doublon. |
| Modification | renvoyer tous les champs, renvoyer les champs modifiés | **Seulement les champs modifiés** (vrai `PATCH`) | Champ absent = inchangé, `null` = effacé : c'est la règle de l'API. N'écrase pas une modification faite ailleurs entre-temps. |

## Décisions de détail

- **`noValidate` sur le `<form>`**, pas d'attribut `required` natif. Les bulles de validation du
  navigateur sont dans la langue **du navigateur**, pas de l'application : elles casseraient
  l'i18n. L'accessibilité passe par `aria-required` ; `maxLength` ne fait que limiter la saisie
  (200 caractères, comme la colonne), ce n'est pas un message de validation.
- **Les erreurs 422 viennent du serveur** : `describeError`/`describeIssue` (ADR 009) choisissent
  le texte d'après le code Pydantic. Une erreur par champ s'affiche sous celui-ci
  (`aria-invalid`, `aria-describedby`, `role="alert"`). Ce qui n'appartient à aucun champ
  (réseau, serveur, champ que le formulaire n'a pas) va dans un bloc au-dessus du formulaire.
- **Focus après un échec** : sur le premier champ invalide, ou sur le bloc d'erreur. Sans cela,
  un utilisateur au clavier resterait sur le bouton sans savoir ce qui s'est passé.
- **Pas de double envoi** : le bouton est désactivé pendant la requête.
- **Rien à envoyer** : si aucun champ n'a changé, pas de requête et pas de message « modifiée »
  (il serait faux).
- **Conversion pure et testée** (`formValues.ts`) : espaces autour des textes retirés, champs
  optionnels vides omis à la création, `null` pour un champ optionnel vidé à la modification.
  Le formulaire n'enlève jamais une erreur : un nom vide est envoyé tel quel et le serveur
  répond 422.
- **Confirmation après enregistrement** : passée à la liste par l'état de navigation du
  routeur (pas dans l'URL : elle ne doit pas être partageable), affichée, puis retirée de
  l'entrée d'historique pour qu'un rechargement ne la répète pas.
- **Identifiant de l'URL** : `abc`, `0`, `-3` ne déclenchent aucune requête ; un identifiant
  inexistant (404) affiche « Cette candidature n'existe pas. ».
- **Nom de fichier** : `formValues.ts` et non `applicationForm.ts`, car sous Windows (insensible
  à la casse) il entrait en collision avec le composant `ApplicationForm.tsx`.

## Limites connues

- **Le calendrier du champ date suit la langue du navigateur**, pas celle de l'application :
  `<input type="date">` est dessiné par le navigateur (noms de mois, premier jour de la semaine,
  ordre jour/mois). Seul le format envoyé est garanti (`AAAA-MM-JJ`). Le texte autour (libellé,
  erreur) reste dans la langue choisie. Un sélecteur de date maison réglerait cela, au prix
  d'un composant accessible à écrire et à maintenir ; non justifié pour une date limite.
- **`status` est obligatoire dans le type généré `ApplicationCreate`**, alors que l'API a
  `APPLIED` par défaut. `openapi-typescript` 7.13.0 traite par défaut un champ avec valeur par
  défaut comme présent. L'option `--default-non-nullable false` le rendrait optionnel : elle
  change **une seule ligne** du fichier généré (vérifié en générant la variante dans un fichier
  temporaire). **Décision : ne pas l'activer.** L'option s'applique aussi aux réponses : un futur
  champ de réponse avec une valeur par défaut deviendrait optionnel dans le type et obligerait à
  gérer `undefined` à la lecture. Le formulaire envoie toujours un statut, donc le type
  trop strict ne cause aucun bug. À revoir si un autre endpoint d'écriture a des champs par
  défaut.
- **Une erreur de champ reste affichée jusqu'au prochain envoi**, même si l'utilisateur
  corrige le champ entre-temps. Simple et prévisible ; l'effacer à la frappe est possible plus
  tard.
- **Accessibilité vérifiée par des tests par rôle et par nom**, pas avec un lecteur d'écran.
  La confirmation « créée » peut ne pas être annoncée (zone live créée en même temps que son
  texte) : voir le backlog.

## Conséquences

- Les règles de validation vivent uniquement dans le backend : une règle ajoutée là-bas
  apparaît dans le formulaire sans changement, à condition que son code d'erreur ait un texte
  dans `describeIssue` (sinon « Valeur invalide »).
- Tout nouveau champ demande : un texte dans les deux dictionnaires, un composant de champ, et
  une ligne dans `formValues.ts`.
