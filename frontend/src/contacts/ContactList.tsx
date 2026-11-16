import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../api'
import { listContacts } from '../api/contacts'
import { describeError } from '../i18n/describeError'
import { useT } from '../i18n/useT'
import { formatContactDate } from './contactValues'

type Props = { applicationId: number }

// The contacts of one application. Its own query, not part of the application's: a
// failure here must not hide the application, and the two refresh independently.
export function ContactList({ applicationId }: Props) {
  const t = useT()
  const { i18n } = useTranslation()
  const query = useQuery({
    queryKey: ['contacts', applicationId],
    queryFn: ({ signal }) => listContacts(api, applicationId, signal),
  })

  return (
    <section aria-labelledby="contacts-heading" className="mt-8">
      <h2 id="contacts-heading" className="text-xl font-semibold">
        {t('contacts.title')}
      </h2>

      {query.isPending && (
        <p role="status" className="mt-2">
          {t('contacts.loading')}
        </p>
      )}

      {query.isError && (
        <div role="alert" className="mt-2 text-red-700">
          <p>{t('contacts.loadError', { reason: describeError(query.error, t) })}</p>
          <button
            type="button"
            onClick={() => void query.refetch()}
            className="mt-2 rounded border border-red-700 px-3 py-1.5"
          >
            {t('applications.retry')}
          </button>
        </div>
      )}

      {query.data && query.data.length === 0 && <p className="mt-2">{t('contacts.empty')}</p>}

      {query.data && query.data.length > 0 && (
        <table className="mt-2 w-full text-left">
          <caption className="sr-only">{t('contacts.caption')}</caption>
          <thead>
            <tr className="border-b border-gray-400">
              <th scope="col" className="py-2 pr-4">{t('contacts.name')}</th>
              <th scope="col" className="py-2 pr-4">{t('contacts.state')}</th>
              <th scope="col" className="py-2 pr-4">{t('contacts.contactedAt')}</th>
              <th scope="col" className="py-2">{t('contacts.repliedAt')}</th>
            </tr>
          </thead>
          <tbody>
            {query.data.map((contact) => (
              <tr key={contact.id} className="border-b border-gray-200">
                <th scope="row" className="py-2 pr-4 font-medium">{contact.name}</th>
                <td className="py-2 pr-4">{t(`contactState.${contact.state}`)}</td>
                <td className="py-2 pr-4">{formatContactDate(contact.contacted_at, i18n.language)}</td>
                <td className="py-2">{formatContactDate(contact.replied_at, i18n.language)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
