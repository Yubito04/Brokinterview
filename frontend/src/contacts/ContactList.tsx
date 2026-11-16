import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../api'
import {
  createContact,
  deleteContact,
  listContacts,
  updateContact,
  type Contact,
} from '../api/contacts'
import { describeError } from '../i18n/describeError'
import { useT } from '../i18n/useT'
import { ContactForm } from './ContactForm'
import {
  EMPTY_CONTACT_FORM,
  formatContactDate,
  toCreateContactBody,
  toUpdateContactBody,
  valuesFromContact,
  type ContactFormValues,
} from './contactValues'

type Props = { applicationId: number }

// Which form is open: none, the one to add a contact, or the one to edit this contact.
type Editing = { kind: 'new' } | { kind: 'edit'; contact: Contact } | null

// The contacts of one application. Its own query, not part of the application's: a
// failure here must not hide the application, and the two refresh independently.
export function ContactList({ applicationId }: Props) {
  const t = useT()
  const { i18n } = useTranslation()
  const queryClient = useQueryClient()
  const addButton = useRef<HTMLButtonElement>(null)
  const [editing, setEditing] = useState<Editing>(null)
  // What the live region says after an action ("Contact supprimé."). The region itself is
  // always on the page, empty, so that its changes are announced.
  const [message, setMessage] = useState('')

  const query = useQuery({
    queryKey: ['contacts', applicationId],
    queryFn: ({ signal }) => listContacts(api, applicationId, signal),
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['contacts', applicationId] })

  // No retry on writes: a POST sent twice would add the contact twice.
  const saveMutation = useMutation({
    mutationFn: async (values: ContactFormValues) => {
      if (editing?.kind === 'edit') {
        return updateContact(api, editing.contact.id, toUpdateContactBody(editing.contact, values))
      }
      return createContact(api, applicationId, toCreateContactBody(values))
    },
    onSuccess: async () => {
      setMessage(editing?.kind === 'edit' ? t('contacts.updated') : t('contacts.added'))
      await refresh()
      closeForm()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (contact: Contact) => deleteContact(api, contact.id),
    onSuccess: () => {
      setMessage(t('contacts.deleted'))
      // The deleted row is gone: the keyboard goes to a stable place of the page.
      addButton.current?.focus()
    },
    // Success or failure (a 404 means someone else already deleted it): read the list again.
    onSettled: refresh,
  })

  function openForm(next: Editing) {
    saveMutation.reset()
    deleteMutation.reset()
    setMessage('')
    setEditing(next)
  }

  function closeForm() {
    setEditing(null)
    addButton.current?.focus()
  }

  function handleSubmit(values: ContactFormValues) {
    // Editing without changing anything: nothing to send, nothing to announce.
    if (editing?.kind === 'edit') {
      const body = toUpdateContactBody(editing.contact, values)
      if (Object.keys(body).length === 0) {
        closeForm()
        return
      }
    }
    saveMutation.mutate(values)
  }

  return (
    <section aria-labelledby="contacts-heading" className="mt-8">
      <div className="flex items-center justify-between gap-4">
        <h2 id="contacts-heading" className="text-xl font-semibold">
          {t('contacts.title')}
        </h2>
        <button
          ref={addButton}
          type="button"
          onClick={() => openForm({ kind: 'new' })}
          className="rounded border border-gray-400 px-4 py-2"
        >
          {t('contacts.add')}
        </button>
      </div>

      <p role="status" className="mt-2 min-h-6">
        {message}
      </p>

      {deleteMutation.isError && (
        <p role="alert" className="mt-2 text-red-700">
          {t('contacts.deleteFailed', { reason: describeError(deleteMutation.error, t) })}
        </p>
      )}

      {query.isPending && <p className="mt-2">{t('contacts.loading')}</p>}

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
              <th scope="col" className="py-2 pr-4">{t('contacts.repliedAt')}</th>
              <th scope="col" className="py-2">
                <span className="sr-only">{t('contacts.actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {query.data.map((contact) => (
              <tr key={contact.id} className="border-b border-gray-200">
                <th scope="row" className="py-2 pr-4 font-medium">{contact.name}</th>
                <td className="py-2 pr-4">{t(`contactState.${contact.state}`)}</td>
                <td className="py-2 pr-4">{formatContactDate(contact.contacted_at, i18n.language)}</td>
                <td className="py-2 pr-4">{formatContactDate(contact.replied_at, i18n.language)}</td>
                <td className="flex gap-3 py-2">
                  {/* The visible word is short; the accessible name says which contact. */}
                  <button
                    type="button"
                    aria-label={t('contacts.edit', { name: contact.name })}
                    onClick={() => openForm({ kind: 'edit', contact })}
                    className="underline"
                  >
                    {t('contacts.editShort')}
                  </button>
                  <button
                    type="button"
                    aria-label={t('contacts.delete', { name: contact.name })}
                    disabled={deleteMutation.isPending}
                    onClick={() => {
                      deleteMutation.reset()
                      setMessage('')
                      deleteMutation.mutate(contact)
                    }}
                    className="underline"
                  >
                    {t('contacts.deleteShort')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing && (
        <ContactForm
          // A new key = a fresh form: opening "edit Bob" after "edit Alice" must not keep
          // what was typed for Alice.
          key={editing.kind === 'edit' ? `edit-${editing.contact.id}` : 'new'}
          title={editing.kind === 'edit' ? t('contacts.formTitleEdit') : t('contacts.formTitleNew')}
          submitLabel={editing.kind === 'edit' ? t('contacts.submitEdit') : t('contacts.submitAdd')}
          initialValues={editing.kind === 'edit' ? valuesFromContact(editing.contact) : EMPTY_CONTACT_FORM}
          error={saveMutation.error}
          saving={saveMutation.isPending}
          onSubmit={handleSubmit}
          onCancel={closeForm}
        />
      )}
    </section>
  )
}
