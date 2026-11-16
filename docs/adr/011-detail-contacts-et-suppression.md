# ADR 011 — Page de détail, contacts et suppression

- **Statut** : Accepté
- **Date** : 2026-11-17

## Contexte

Après la liste et le formulaire, il faut voir une candidature en entier, gérer ses contacts
(afficher, ajouter, modifier, supprimer) et pouvoir supprimer la candidature elle-même. Trois
sujets délicats : des dates **avec heure** (les contacts), une règle de cohérence entre deux
dates, et une action **destructrice** (la suppression emporte les contacts, par cascade).

## Options envisagées et décisions

| Sujet | Options | Décision | Raison principale |
|---|---|---|---|
| Page de détail | page `/applications/:id`, détail fusionné avec la modification, panneau latéral | **Page dédiée**, avec un lien « Modifier » vers le formulaire | Une adresse par écran, partageable ; le formulaire garde son rôle. |
| Formulaires de contact | en ligne sous le tableau, fenêtre modale, pages dédiées | **En ligne** | Pas de piège de focus à écrire pour une fenêtre ; deux dates et un nom ne justifient pas une page. |
| Dates des contacts | `datetime-local`, date seule | **`datetime-local`** | L'API stocke un instant : la date seule ferait perdre l'heure. |
| Confirmation de suppression | `window.confirm`, `<dialog>` natif, bloc dans la page | **Bloc dans la page** | `window.confirm` est dans la langue du navigateur (même problème que les bulles de validation) ; `<dialog>` est mal géré par jsdom, donc peu testable. |
| Suppression d'un contact | confirmation, suppression directe | **Directe**, avec un message annoncé | Donnée mineure ; la confirmation est réservée à la candidature (qui emporte ses contacts). Voir les limites. |
| Après une suppression | retirer la ligne avant la réponse (optimiste), attendre la réponse | **Attendre la réponse** | En cas d'échec, il faudrait remettre la ligne ; ici l'utilisateur voit l'état réel. |

## Dates avec heure : instants et heure locale

- **Deux représentations.** L'API stocke et renvoie un **instant** (`2026-11-10T10:00:00Z`, UTC).
  L'utilisateur lit et tape une **heure murale** dans son fuseau (11:00 à Paris, 02:00 à Los
  Angeles, pour le même instant). `contactValues.ts` convertit dans les deux sens ; le champ
  `datetime-local` ne porte jamais de fuseau (`2026-11-10T11:00`).
- **Le formulaire envoie toujours un instant avec son décalage** (`toISOString()` donne `…Z`) : le
  serveur n'a jamais à deviner un fuseau.
- **Convention de l'API : une date sans fuseau est lue comme UTC.** Un client qui enverrait
  `2026-11-01T10:00:00` sans `Z` est compris comme 10:00 UTC. C'est la convention de toute
  l'API et celle de la base ; elle est appliquée explicitement dans la règle de cohérence (voir
  ci-dessous), car Python refuse de comparer une date sans fuseau à une date avec fuseau
  (`TypeError`). Un test couvre les deux cas.
- **Modification comparée à la précision de l'input (la minute).** Une date enregistrée avec des
  secondes (`10:00:30`) s'affiche `10:00` ; comparer des instants y verrait une « modification » et
  la réécrirait sans que l'utilisateur ait rien touché. On compare donc ce que le champ affiche
  au début et à la fin.
- **Affichage** : `Intl.DateTimeFormat` en `dateStyle: 'medium'` et `timeStyle: 'short'`, dans la
  langue de l'interface et le fuseau local. Les tests fixent le fuseau (`vi.stubEnv('TZ', …)`) ;
  ils échouent si la conversion lit les heures en UTC (vérifié par mutation).

## Règle de cohérence des dates d'un contact (backend)

- **Deux codes d'erreur stables**, traduits côté frontend comme `null_not_allowed` :
  `reply_without_contact` (une réponse sans date de contact) et `reply_before_contact`
  (réponse strictement antérieure au contact). Une réponse au même instant est acceptée.
- **À la création**, un validateur de **champ** sur `replied_at` : l'erreur porte
  `loc: ["body", "replied_at"]` et s'affiche sous le bon champ. Un validateur de modèle aurait
  donné `loc: ["body"]`.
- **À la modification (`PATCH`)**, la règle se vérifie sur l'**état fusionné** : le `PATCH` ne
  transporte que les champs envoyés ; envoyer seulement `replied_at` doit être comparé à la date
  de contact **déjà enregistrée**. La règle vit donc dans l'endpoint (`RequestValidationError`
  construite à la main, même forme qu'un 422 de Pydantic, sans `ctx`), pas dans le schéma.
- **Seulement si la requête touche une des deux dates** : renommer un contact enregistré avant
  la règle, avec des dates incohérentes, reste possible. Un test le couvre.
- Une requête refusée ne change rien en base (vérifié par un test).
- Effacer la date de contact alors qu'une réponse reste enregistrée est refusé
  (`reply_without_contact`) : il faut effacer les deux ensemble.

## Suppression d'une candidature

- **La confirmation dit ce qui sera perdu** : le nombre de contacts (la suppression est en
  cascade côté API). Tant que le nombre est inconnu (chargement, ou échec du chargement des
  contacts), le texte dit « et ses contacts éventuels » plutôt qu'un chiffre qui pourrait être
  faux.
- **Le focus va sur « Annuler »**, le choix sûr : un `Entrée` machinal n'efface rien. `Échap`
  annule, et le focus revient sur le bouton « Supprimer ». Pendant la requête, les deux boutons
  sont désactivés ; en cas d'échec, le focus va sur le message d'erreur.
- **Nettoyage du cache au démontage de la page, pas avant.** Un premier essai retirait les
  requêtes du cache dans `onSuccess` ; un test a montré que l'écran, encore monté, les recréait et
  redemandait les contacts d'une candidature supprimée (un 404 avec le vrai serveur). Retirer une
  requête qu'un écran observe encore la relance. Le nettoyage se fait donc à la sortie de la
  page ; un test vérifie qu'ouvrir de nouveau l'ancienne adresse n'affiche même pas un instant la
  candidature supprimée.

## Zone de confirmation annoncée

Les lecteurs d'écran annoncent le **changement** du contenu d'une zone `role="status"`, pas
une zone qui apparaît déjà remplie. La zone de la liste (confirmations « créée », « modifiée »,
« supprimée ») et celle des contacts sont donc présentes et **vides dès le premier rendu**, puis
remplies. Un test de rendu côté serveur vérifie que le premier rendu contient la zone vide.

## Limites connues

- **Le sélecteur `datetime-local` suit la langue du navigateur**, comme le champ date (ADR 010) :
  noms de mois, premier jour de la semaine, format 12 h / 24 h. Le libellé et les erreurs restent
  dans la langue choisie. Un sélecteur maison réglerait cela, au prix d'un composant accessible à
  maintenir.
- **Suppression d'un contact sans confirmation et sans annulation possible.** Un clic maladroit
  efface un contact pour de bon. Pistes : confirmation en ligne, ou « Annuler » proposé quelques
  secondes dans la zone de message.
- **Pas de gestion des conflits** : si une autre session modifie un contact entre-temps, le dernier
  enregistrement gagne (le `PATCH` ne compare pas de version).
- **Accessibilité vérifiée par des tests par rôle et par nom, pas avec un lecteur d'écran** : le
  comportement des zones `role="status"` et du focus reste à confirmer avec NVDA.
- **Un test du formulaire de candidature a échoué de façon intermittente** (cause non démontrée,
  suivi dans le backlog) ; les 40 lancements de mesure n'ont montré aucun échec.

## Conséquences

- Tout nouveau formulaire réutilise `useServerErrors` et `ErrorSummary` : les erreurs 422 se
  placent seules sous les champs si leur code a un texte dans `describeIssue`.
- Une règle de cohérence qui dépend de l'état enregistré se vérifie sur l'état fusionné, dans
  l'endpoint.
- Toute action destructrice du frontend suit le modèle de la suppression de candidature :
  confirmation dans la page, focus sur le choix sûr, effet sur le cache après la sortie de la
  page.
