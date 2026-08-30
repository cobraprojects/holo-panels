'use client'

import { createPanelTranslator, executePanelAuthRequest, panelContentWidthValue, syncDocumentLocale } from '@holo-js/panels-react'
import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import { nextPanelAuthAppearanceVariables } from './auth-appearance'
import { useNextPanelAuthPresentation } from './auth-presentation'
import { Button, Card, CardContent, CardDescription, CardHeader, PanelsIcon, Input, Label } from './internal-ui'

export interface NextPanelProfilePageProps {
  readonly panelId: string
}

function cookie(name: string): string {
  const entry = document.cookie.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`))
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : ''
}

function label(field: string): string {
  return field.replaceAll('_', ' ').replace(/\b\w/gu, letter => letter.toUpperCase())
}

function inputType(field: string, value: unknown): 'checkbox' | 'email' | 'number' | 'text' {
  if (typeof value === 'boolean') return 'checkbox'
  if (typeof value === 'number') return 'number'
  return field === 'email' ? 'email' : 'text'
}

export function NextPanelProfilePage({ panelId }: NextPanelProfilePageProps) {
  const [values, setValues] = useState<Readonly<Record<string, unknown>>>({})
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [locale, setLocale] = useState('en')
  const translate = useMemo(() => createPanelTranslator(locale), [locale])
  const direction = locale.toLowerCase().startsWith('ar') ? 'rtl' : 'ltr'
  const presentation = useNextPanelAuthPresentation(panelId)
  useEffect(() => setLocale(navigator.language), [])
  useEffect(() => syncDocumentLocale({ direction, locale }, document), [direction, locale])
  useEffect(() => {
    void executePanelAuthRequest({ csrfToken: cookie('XSRF-TOKEN'), operation: 'profile-read', panelId, payload: {} }).then((result) => {
      if (!result.ok || typeof result.data !== 'object' || result.data === null || !('values' in result.data) || typeof result.data.values !== 'object' || result.data.values === null || Array.isArray(result.data.values)) setError(translate('auth.profileLoadFailed'))
      else setValues(result.data.values as Readonly<Record<string, unknown>>)
    })
  }, [panelId, translate])

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setError('')
    setSaved(false)
    const data = new FormData(event.currentTarget)
    const updated = Object.fromEntries(Object.entries(values).map(([field, value]) => [field, typeof value === 'boolean' ? data.get(field) === 'on' : typeof value === 'number' ? Number(data.get(field)) : String(data.get(field) ?? '')]))
    const result = await executePanelAuthRequest({ csrfToken: cookie('XSRF-TOKEN'), operation: 'profile-update', panelId, payload: { values: updated } })
    if (!result.ok) setError(translate('auth.profileSaveFailed'))
    else {
      setValues(Object.freeze(updated))
      setSaved(true)
    }
  }

  if (!presentation) return <main className="hp-auth-page hp:flex hp:min-h-svh hp:items-center hp:justify-center hp:bg-muted/40 hp:p-4" data-holo-panel><Card className="hp-auth-card hp:h-80 hp:w-full hp:max-w-md hp:animate-pulse" /></main>
  const { appearance, brandName, simplePageMaxContentWidth, theme } = presentation
  const style = { ...nextPanelAuthAppearanceVariables(appearance), '--hp-auth-max-width': panelContentWidthValue(simplePageMaxContentWidth) } as CSSProperties
  return <main className="hp-auth-page hp:flex hp:min-h-svh hp:items-center hp:justify-center hp:bg-muted/40 hp:p-4" data-density={appearance.density} data-holo-panel data-theme={theme} dir={direction} lang={locale} style={style}><Card className="hp-auth-card hp:w-full hp:max-w-md"><CardHeader className="hp:space-y-2"><span className="hp:flex hp:size-10 hp:items-center hp:justify-center hp:rounded-md hp:bg-primary hp:text-primary-foreground"><PanelsIcon name="user" /></span><div className="hp:space-y-1"><p className="hp:text-sm hp:font-medium hp:text-muted-foreground">{brandName}</p><h1 className="hp:text-2xl hp:font-semibold hp:leading-none">{translate('auth.profile')}</h1><CardDescription>{translate('auth.profileDescription')}</CardDescription></div></CardHeader><CardContent><form className="hp:space-y-4" onSubmit={submit}>{Object.entries(values).map(([field, value]) => <div className="hp-auth-field hp:grid hp:gap-2" key={field}><Label htmlFor={`${panelId}-${field}`}>{field === 'email' ? translate('auth.email') : field === 'name' ? translate('auth.name') : label(field)}</Label><Input autoComplete={field === 'email' ? 'email' : field === 'name' ? 'name' : undefined} defaultChecked={typeof value === 'boolean' ? value : undefined} defaultValue={typeof value === 'boolean' ? undefined : String(value ?? '')} id={`${panelId}-${field}`} name={field} type={inputType(field, value)} /></div>)}{error ? <p className="hp:text-sm hp:text-destructive" role="alert">{error}</p> : null}{saved ? <p className="hp:text-sm hp:text-muted-foreground" role="status">{translate('auth.profileSaved')}</p> : null}<Button className="hp:w-full" type="submit">{translate('auth.saveChanges')}</Button></form></CardContent></Card></main>
}
