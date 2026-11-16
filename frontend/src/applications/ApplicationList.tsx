import { Link } from 'react-router'
import type { Application } from '../api/applications'
import { useTranslation } from 'react-i18next'
import { formatDeadline } from './formatDeadline'
import { useT } from '../i18n/useT'

type Props = {
  applications: Application[]
  // True while the rows shown are the previous ones and new ones are loading.
  stale?: boolean
}

export function ApplicationList({ applications, stale = false }: Props) {
  const t = useT()
  const { i18n } = useTranslation()
  return (
    <table aria-busy={stale} className={`w-full text-left ${stale ? 'opacity-60' : ''}`}>
      <caption className="sr-only">{t('table.caption')}</caption>
      <thead>
        <tr className="border-b border-gray-400">
          <th scope="col" className="py-2 pr-4">{t('table.company')}</th>
          <th scope="col" className="py-2 pr-4">{t('table.position')}</th>
          <th scope="col" className="py-2 pr-4">{t('table.status')}</th>
          <th scope="col" className="py-2 pr-4">{t('table.location')}</th>
          <th scope="col" className="py-2 pr-4">{t('table.deadline')}</th>
          <th scope="col" className="py-2"><span className="sr-only">{t('table.actions')}</span></th>
        </tr>
      </thead>
      <tbody>
        {applications.map((application) => (
          <tr key={application.id} className="border-b border-gray-200">
            <th scope="row" className="py-2 pr-4 font-medium">
              <Link to={`/applications/${application.id}`} className="underline">
                {application.company}
              </Link>
            </th>
            <td className="py-2 pr-4">{application.position}</td>
            <td className="py-2 pr-4">{t(`status.${application.status}`)}</td>
            <td className="py-2 pr-4">{application.location ?? '—'}</td>
            <td className="py-2 pr-4">{formatDeadline(application.deadline, i18n.language)}</td>
            <td className="py-2">
              {/* The visible word is short; the accessible name says which row. */}
              <Link
                to={`/applications/${application.id}/edit`}
                aria-label={t('table.edit', { company: application.company })}
                className="underline"
              >
                {t('table.editShort')}
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
