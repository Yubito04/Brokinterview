import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { setLanguage } from './createI18n'
import { FALLBACK_LANGUAGE, isLanguage, LANGUAGES, type Language } from './languages'
import { useT } from './useT'

// Each language is written in itself, so it can be found even when the page is in a
// language the visitor does not read. These names are not translated.
const LANGUAGE_NAMES: Record<Language, string> = {
  fr: 'Français',
  en: 'English',
}

export function LanguageSwitcher() {
  const t = useT()
  const { i18n } = useTranslation()
  const id = useId()
  const current = isLanguage(i18n.language) ? i18n.language : FALLBACK_LANGUAGE

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {t('language.label')}
      </label>
      <select
        id={id}
        value={current}
        onChange={(event) => {
          // A <select> hands back text: check it is one of ours before using it.
          if (isLanguage(event.target.value)) void setLanguage(i18n, event.target.value)
        }}
        className="rounded border border-gray-400 px-2 py-1.5"
      >
        {LANGUAGES.map((language) => (
          // lang: a screen reader pronounces each name in its own language.
          <option key={language} value={language} lang={language}>
            {LANGUAGE_NAMES[language]}
          </option>
        ))}
      </select>
    </div>
  )
}
