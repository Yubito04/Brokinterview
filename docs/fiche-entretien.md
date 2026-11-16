# Fiche d'entretien : les 15 questions les plus probables

Réponses courtes (deux ou trois phrases), à reformuler avec mes propres mots. Le détail, les
limites et les références sont dans [`interview-prep.md`](interview-prep.md).

**1. Présente ton projet en trente secondes.**
ApplyFlow AI est un suivi de candidatures : on colle le texte d'une offre, un modèle d'IA propose
l'entreprise, le poste, le lieu et la date limite, et l'utilisateur relit avant d'enregistrer.
Backend FastAPI et PostgreSQL, frontend React et TypeScript, interface bilingue. Je peux défendre
chaque décision : elles sont écrites dans 12 ADR.

**2. Pourquoi FastAPI ?**
Mes projets universitaires montraient déjà Java et Spring Boot ; je voulais une autre stack, et
Python est l'écosystème naturel pour un LLM. FastAPI donne la validation (Pydantic) et la
documentation OpenAPI presque gratuitement. Contrepartie : il impose moins de structure, donc c'est
à moi de l'organiser.

**3. Comment fonctionne l'extraction, et comment gères-tu les erreurs du modèle ?**
L'API envoie le texte à Claude Haiku avec une sortie structurée (un schéma Pydantic), donc je
reçois un objet typé et non du texte à parser. Le schéma garantit la forme, pas la justesse :
tous les champs peuvent être `null`, rien n'est enregistré automatiquement, et l'écran avertit de
revérifier le poste et la date limite, les deux champs instables dans mon évaluation.

**4. Qu'est-ce que l'injection de prompt, et comment t'en protèges-tu ?**
Une offre est un texte écrit par un tiers, qui peut contenir « ignore tes instructions ». J'atténue :
le texte est entre balises et le prompt interdit de suivre ses instructions, le modèle n'a aucun
outil, la réponse est affichée comme du texte, et surtout l'utilisateur valide avant tout
enregistrement. Ce n'est pas une garantie, et mon essai sur une offre piégée est une observation, pas
une preuve.

**5. Comment testes-tu du code qui appelle un LLM ?**
Par défaut avec un faux extracteur et une couche HTTP simulée : aucun réseau, aucun coût, résultats
répétables. Trois tests appellent le vrai modèle, seulement sur demande, et ils vérifient des
fragments plutôt qu'une réponse exacte, car le modèle varie d'un appel à l'autre.

**6. Comment maîtrises-tu le coût de l'IA ?**
Texte limité à 20 000 caractères, `max_tokens` borné, petit modèle, effort bas, délais bornés
(environ 41 secondes au pire) et un bouton désactivé pendant l'appel, donc un seul appel part. Limite à admettre : il n'y a
ni authentification ni limitation d'appels, donc je ne le mettrais pas en ligne tel quel (ADR 013).

**7. Comment testes-tu le backend, et pourquoi une vraie base PostgreSQL ?**
Les tests tournent sur une vraie base `_test` reconstruite avec les migrations, chaque test dans une
transaction annulée à la fin. SQLite aurait caché des différences (type enum, comportements SQL),
et un garde-fou refuse de démarrer si la base ne finit pas par `_test`, car la suite supprime ses
tables.

**8. Comment testes-tu le frontend, et comment sais-tu que tes tests servent ?**
Des tests React Testing Library qui cherchent par rôle et par nom, comme un utilisateur ou un lecteur
d'écran, contre un faux serveur. Pour vérifier qu'ils testent vraiment, je casse volontairement le
code (après l'avoir commité) et je constate qu'un test échoue : cela a révélé des tests trop
faibles que j'ai corrigés.

**9. `PUT` ou `PATCH` ? Comment gères-tu `null` ?**
`PATCH` pour une modification partielle : un champ absent reste inchangé. `null` sur un champ
obligatoire est une erreur 422 avec un code stable, `null` sur un champ optionnel l'efface. Le
formulaire n'envoie que les champs modifiés.

**10. Pourquoi des migrations Alembic plutôt que `create_all` ?**
`create_all` crée les tables mais ne sait pas modifier un schéma existant ni garder d'historique.
Les migrations versionnent le schéma, s'appliquent en production et se défont ; un test échoue si un
modèle change sans migration, et j'ai vécu l'oubli : sans la migration appliquée, chaque requête
renvoyait une erreur 500.

**11. Qu'est-ce que le CORS, et pourquoi en as-tu besoin ?**
Le navigateur bloque la lecture d'une réponse venue d'une autre origine (ici `localhost:5173` vers le
port de l'API) sauf si le serveur l'autorise par des en-têtes. Je liste les origines exactes, sans
`*`, et `localhost` et `127.0.0.1` sont deux origines différentes. Limite connue : une erreur 500 non
gérée n'a pas ces en-têtes et ressemble à une panne réseau (au backlog).

**12. Comment affiches-tu les erreurs de validation ?**
Le formulaire ne valide rien lui-même : l'API répond 422 avec un code stable (`string_too_short`), et
le frontend choisit son texte traduit d'après ce code, sous le bon champ, jamais d'après la phrase
anglaise. Une seule source de règles : le serveur. Contrepartie : l'erreur n'apparaît qu'après un
aller-retour.

**13. Comment as-tu rendu l'interface bilingue ?**
`react-i18next` avec deux dictionnaires ; la langue vient du choix mémorisé, sinon du navigateur,
sinon de l'anglais. Un test échoue si les deux dictionnaires n'ont pas les mêmes clés et variables, et
dates, statuts et erreurs sont traduits à l'affichage. Limite : les sélecteurs de date natifs restent
dans la langue du navigateur.

**14. Comment gères-tu les dates et les fuseaux horaires ?**
L'API stocke des instants UTC ; l'utilisateur tape une heure locale. Le formulaire convertit dans les
deux sens et envoie toujours une date avec son décalage, et l'API lit une date sans fuseau comme UTC.
Une date de calendrier comme l'échéance est affichée en UTC, sinon elle montrerait la veille à
l'ouest de Greenwich.

**15. Quelles sont les limites, et que ferais-tu avant de mettre le projet en ligne ?**
Aucune authentification ni limite d'appels (donc la clé d'IA pourrait être dépensée par n'importe qui),
les compétences extraites ne sont pas stockées, l'accessibilité n'est vérifiée que par des tests
automatiques, et l'évaluation de l'IA est trop petite pour donner un taux de réussite. Avant la mise
en ligne : comptes et données par utilisateur, quota d'extraction et plafond chez le fournisseur,
HTTPS et secrets dans l'environnement, intégration continue (ADR 013, proposé).
