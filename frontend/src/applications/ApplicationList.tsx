import type { Application } from '../api/applications'
import { formatDeadline } from './formatDeadline'
import { STATUS_LABELS } from './statusLabels'

type Props = {
  applications: Application[]
  // True while the rows shown are the previous ones and new ones are loading.
  stale?: boolean
}

export function ApplicationList({ applications, stale = false }: Props) {
  return (
    <table aria-busy={stale} className={`w-full text-left ${stale ? 'opacity-60' : ''}`}>
      <caption className="sr-only">Liste des candidatures</caption>
      <thead>
        <tr className="border-b border-gray-400">
          <th scope="col" className="py-2 pr-4">Entreprise</th>
          <th scope="col" className="py-2 pr-4">Poste</th>
          <th scope="col" className="py-2 pr-4">Statut</th>
          <th scope="col" className="py-2 pr-4">Lieu</th>
          <th scope="col" className="py-2">Date limite</th>
        </tr>
      </thead>
      <tbody>
        {applications.map((application) => (
          <tr key={application.id} className="border-b border-gray-200">
            <th scope="row" className="py-2 pr-4 font-medium">{application.company}</th>
            <td className="py-2 pr-4">{application.position}</td>
            <td className="py-2 pr-4">{STATUS_LABELS[application.status]}</td>
            <td className="py-2 pr-4">{application.location ?? '—'}</td>
            <td className="py-2">{formatDeadline(application.deadline)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
