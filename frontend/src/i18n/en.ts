import type { Messages } from './messages'

export const en: Messages = {
  language: {
    label: 'Langue / Language',
  },
  applications: {
    title: 'Applications',
    loading: 'Loading applications…',
    updating: 'Updating…',
    loadError: 'Could not load the applications: {{reason}}',
    retry: 'Try again',
    empty: {
      none: 'No applications yet.',
      filtered: 'No application matches the current filters.',
    },
  },
  filters: {
    searchLabel: 'Search (company or position)',
    statusLabel: 'Status',
    allStatuses: 'All statuses',
  },
  status: {
    APPLIED: 'Applied',
    INTERVIEW: 'Interview',
    OFFER: 'Offer',
    REJECTED: 'Rejected',
  },
  pagination: {
    label: 'Pagination',
    previous: 'Previous page',
    next: 'Next page',
    position: 'Page {{page}} of {{total}}',
  },
  table: {
    caption: 'Applications list',
    company: 'Company',
    position: 'Position',
    status: 'Status',
    location: 'Location',
    deadline: 'Deadline',
  },
}
