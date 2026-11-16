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
  form: {
    company: 'Company',
    position: 'Position',
    status: 'Status',
    location: 'Location',
    deadline: 'Deadline',
    requiredNote: 'Fields marked with * are required.',
  },
  errors: {
    network: 'Cannot reach the server. Is it running?',
    timeout: 'The server took more than {{seconds}} seconds to answer. Try again.',
    unavailable: 'This service is not available right now.',
    upstream: 'The AI service failed. Try again in a moment.',
    upstreamTimeout: 'The AI service took too long to answer. Try again.',
    notFound: 'Not found.',
    http: 'Unexpected error (HTTP {{status}}).',
    validation: 'Some fields are invalid.',
    unknown: 'An unexpected error occurred.',
  },
  validation: {
    missing: 'This field is required.',
    nullNotAllowed: 'This field cannot be empty.',
    notText: 'This field must contain text.',
    tooShort: 'Too short (minimum: {{min}}).',
    tooLong: 'Too long (maximum: {{max}}).',
    unknownChoice: 'This value is not in the list.',
    invalidDate: 'Invalid date (format YYYY-MM-DD).',
    invalidDateTime: 'Invalid date and time.',
    invalid: 'Invalid value.',
  },
}
