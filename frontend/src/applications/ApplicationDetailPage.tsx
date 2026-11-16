import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import type { Application } from '../api/applications'
import { ContactList } from '../contacts/ContactList'
import { useT } from '../i18n/useT'
import { ApplicationLoader } from './ApplicationLoader'
import { formatDeadline } from './formatDeadline'

export function ApplicationDetailPage() {
  return <ApplicationLoader>{(application) => <Detail application={application} />}</ApplicationLoader>
}

function Detail({ application }: { application: Application }) {
  const t = useT()
  const { i18n } = useTranslation()
  return (
    <main className="mx-auto max-w-4xl p-8">
      <Link to="/" className="underline">
        {t('form.backToList')}
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">{application.company}</h1>
        <Link
          to={`/applications/${application.id}/edit`}
          className="rounded border border-gray-400 px-4 py-2"
        >
          {t('detail.edit')}
        </Link>
      </div>

      {/* A description list: each term is announced with its value. */}
      <dl className="mt-4 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2">
        <dt className="font-medium">{t('table.position')}</dt>
        <dd>{application.position}</dd>
        <dt className="font-medium">{t('table.status')}</dt>
        <dd>{t(`status.${application.status}`)}</dd>
        <dt className="font-medium">{t('table.location')}</dt>
        <dd>{application.location ?? '—'}</dd>
        <dt className="font-medium">{t('table.deadline')}</dt>
        <dd>{formatDeadline(application.deadline, i18n.language)}</dd>
      </dl>

      <ContactList applicationId={application.id} />
    </main>
  )
}
