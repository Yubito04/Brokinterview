// French dictionary: the REFERENCE. Its shape (its keys) defines what every other
// language must provide: see Messages in messages.ts.
// {{name}} marks a variable filled in by the code.
export const fr = {
  language: {
    // Same text in both languages on purpose: findable even when the page is in
    // the wrong language.
    label: 'Langue / Language',
  },
  applications: {
    title: 'Candidatures',
    loading: 'Chargement des candidatures…',
    updating: 'Mise à jour…',
    loadError: 'Impossible de charger les candidatures : {{reason}}',
    retry: 'Réessayer',
    empty: {
      none: "Aucune candidature pour l'instant.",
      filtered: 'Aucune candidature ne correspond aux filtres actuels.',
    },
  },
  filters: {
    searchLabel: 'Rechercher (entreprise ou poste)',
    statusLabel: 'Statut',
    allStatuses: 'Tous les statuts',
  },
  // The API's status codes (APPLIED...) are shown through these texts.
  status: {
    APPLIED: 'Postulé',
    INTERVIEW: 'Entretien',
    OFFER: 'Offre',
    REJECTED: 'Refusé',
  },
  pagination: {
    label: 'Pagination',
    previous: 'Page précédente',
    next: 'Page suivante',
    position: 'Page {{page}} sur {{total}}',
  },
  table: {
    caption: 'Liste des candidatures',
    company: 'Entreprise',
    position: 'Poste',
    status: 'Statut',
    location: 'Lieu',
    deadline: 'Date limite',
  },
}
