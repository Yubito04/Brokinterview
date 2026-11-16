import type { ApplicationStatus } from '../api/applications'

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  APPLIED: 'Postulé',
  INTERVIEW: 'Entretien',
  OFFER: 'Offre',
  REJECTED: 'Refusé',
}
