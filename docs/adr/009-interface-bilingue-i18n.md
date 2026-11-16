# ADR 009 — Interface bilingue (français et anglais)

- **Statut** : Accepté
- **Date** : 2026-11-16

## Contexte

L'interface doit exister en français et en anglais. La décision est prise avant les écrans de
formulaire, de détail et d'extraction, pour ne pas devoir reprendre chaque écran plus tard.
Trois questions : quelle bibliothèque, comment choisir et mémoriser la langue, comment
traduire ce qui n'est pas du texte écrit à la main (dates, statuts, erreurs, dont les erreurs
422 de Pydantic qui arrivent en anglais).

## Options envisagées et décisions

| Sujet | Options | Décision | Raison principale |
|---|---|---|---|
| Bibliothèque | react-i18next, react-intl (FormatJS), système maison | **react-i18next**, sans plugin de détection | Standard du marché, interpolation et pluriels inclus. La détection est une petite fonction à nous, donc une dépendance de moins et un comportement testé. |
| Langue au démarrage | langue du navigateur seule, choix mémorisé seul | **Choix mémorisé, sinon navigateur, sinon anglais** | Respecte le choix de l'utilisateur et sa langue ; l'anglais est la langue de secours la plus universelle. |
| Mémorisation | `localStorage`, cookie, compte utilisateur | **`localStorage`** (clé `applyflow.lang`) | Aucun serveur, aucun compte ; propre à l'appareil. |
| Dates | format écrit à la main, `Intl.DateTimeFormat` | **`Intl`**, `dateStyle: 'medium'` | « 20 nov. 2026 » / « Nov 20, 2026 » : pas d'ambiguïté entre jour et mois. |
| Textes de l'API | traduction côté backend (`Accept-Language`), traduction côté frontend | **Côté frontend** | L'API reste neutre (codes et statuts) ; Pydantic ne traduit pas ses messages. |
| Erreurs 422 | traduire le texte `msg`, traduire d'après le code `type` | **Code `type` et `ctx`** | Le texte anglais change d'une version à l'autre ; le code est stable. |

## Décisions de détail

- **Détection** : `initialLanguage(stored, browserLanguages)` est une fonction pure. Un choix
  mémorisé invalide est ignoré ; `fr-CA` donne `fr`.
- **Rien n'est mémorisé au démarrage**, seulement un choix explicite du sélecteur. Sinon la
  langue détectée deviendrait un « choix » et le navigateur ne serait plus suivi.
- **`<html lang>`** suit la langue affichée : les lecteurs d'écran en dépendent.
- **Pas de langue de secours entre dictionnaires** (`fallbackLng: false`) : une traduction
  manquante affiche sa clé, donc se voit tout de suite.
- **Le dictionnaire français est la référence.** Le dictionnaire anglais est typé par sa forme
  (`Messages`) : une clé manquante ou en trop est une erreur de compilation.
- **Test de parité** : les deux dictionnaires doivent avoir les mêmes clés et les mêmes
  `{{variables}}`, sans texte vide. Les suffixes de pluriel (`_one`, `_many`, `_other`) sont
  ignorés, car le français a une catégorie `many` que l'anglais n'a pas. Le vérificateur est
  lui-même testé, sinon un vérificateur cassé laisserait tout passer.
- **Langue des tests** : le français, forcé avant chaque test (jsdom annonce `en-US`). Quelques
  tests passent en anglais explicitement.

## Pourquoi `useT` existe (et ce qu'on perd)

`react-i18next` sait typer les clés : `t('pagination.nxt')` ne compilerait pas. Avec les
versions installées (`i18next` 27.1.3, `react-i18next` 18.0.2), ce typage **refusait les clés
sans préfixe** : seule la forme `translation:pagination.next` passait, y compris dans une
déclaration minimale de deux clés. **La cause n'a pas été trouvée** (bug de la bibliothèque ou
réglage que je n'ai pas vu) ; le temps passé n'était pas proportionné.

Contournement : un type `MessageKey`, calculé à partir du dictionnaire français (tous les
chemins `a.b.c` menant à un texte), et un hook `useT()` qui l'impose à l'appel. Une faute de
frappe ou une clé retirée reste une erreur de compilation (testé avec `@ts-expect-error`).

**Ce que l'on perd :** le typage natif vérifiait aussi les variables d'un texte
(`t('pagination.position', {page, total})` : oublier `total` ne compilait pas). Avec `useT`, les
variables sont `Record<string, string | number>`. Elles restent protégées, plus tard dans la
chaîne : par le test de parité (mêmes variables en français et en anglais) et par les tests des
écrans (le texte affiché est vérifié). Une variable oubliée dans un écran sans test ne serait
pas vue à la compilation.

Retenter le typage natif est au backlog, en temps limité.

## Erreurs : deux textes pour deux lecteurs

`ApiError` garde un `message` anglais, pour les journaux et le débogueur, et ne l'affiche
jamais. Ce que l'utilisateur lit vient de deux fonctions :

- `describeError(erreur, t)` choisit un texte d'après le `kind` (réseau, délai, 404...). La table
  est un `Record` sur tous les `kind` : en ajouter un sans texte ne compile pas. Les détails
  (`seconds`, `status`) sont dans `ApiError.params`.
- `describeIssue(issue, t)` traduit une erreur de champ 422 d'après son `type` Pydantic et son
  `ctx` (`string_too_short` + `min_length: 1`). Un code inconnu, ou un détail absent, donne
  « Valeur invalide » plutôt qu'une phrase cassée.

Les codes de la table viennent des vraies réponses de l'API, pas de suppositions.

**`null_not_allowed`.** La règle PATCH « X ne peut pas être null » levait un `ValueError`, que
Pydantic range sous le code générique `value_error`. Elle lève maintenant une
`PydanticCustomError("null_not_allowed", ..., {"field": nom})` : le frontend rattache l'erreur au
bon champ sans lire de phrase. Le test de contrat OpenAPI passe sans régénération : le schéma
standard de FastAPI ne déclare pas `ctx`.

## Dates

`Intl.DateTimeFormat` avec `dateStyle: 'medium'`, dans la langue courante. Une date sans heure
(`"2026-11-20"`) est lue comme minuit UTC et formatée **en UTC** : dans le fuseau du lecteur, elle
afficherait la veille à l'ouest de Greenwich. Une date qui n'existe pas (`2026-02-31`) est
affichée telle quelle plutôt que corrigée en silence. Le test force un fuseau à l'ouest et
échoue si le `timeZone: 'UTC'` est retiré (vérifié).

## Avancement

1. ✔ Cœur : détection, mémorisation, `<html lang>` (`src/i18n/`).
2. ✔ Dictionnaires, `Messages`, `MessageKey`, test de parité.
3. ✔ Provider, sélecteur de langue, composants existants.
4. ✔ Erreurs : `kind` traduit, codes `type`/`ctx` des 422, code `null_not_allowed` côté backend.
5. ✔ Dates avec `Intl`.
6. ✔ Mise à jour finale de cet ADR, README, learning-log, interview-prep.

## Conséquences

- Tout nouveau texte visible passe par `useT` et les deux dictionnaires ; le test de parité
  échoue s'il manque d'un côté.
- Les codes de l'API (statuts, types d'erreur) restent en anglais et sont traduits à
  l'affichage ; l'API n'a pas de notion de langue.
- Le choix de langue est propre à l'appareil (il ne suit pas l'utilisateur d'un navigateur à
  l'autre).
