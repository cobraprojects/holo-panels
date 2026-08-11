'use client'

import { executePanelAuthRequest, panelContentWidthValue, panelThemeVariables } from '@holo-js/panels-react'
import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { ShadcnButton, ShadcnCard, ShadcnCardContent, ShadcnCardHeader, ShadcnIcon, ShadcnInput, ShadcnLabel } from './internal-ui'

export interface NextPanelProfilePageProps {
  readonly brandName: string
  readonly panelId: string
  readonly simplePageMaxContentWidth?: string
  readonly theme?: 'dark' | 'light' | 'system'
  readonly themeColors?: Readonly<Record<string, string>>
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

export function NextPanelProfilePage({ brandName, panelId, simplePageMaxContentWidth, theme = 'system', themeColors }: NextPanelProfilePageProps) {
  const [values, setValues] = useState<Readonly<Record<string, unknown>>>({})
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const style = { ...panelThemeVariables({ colors: themeColors }), ...(simplePageMaxContentWidth ? { '--hp-auth-max-width': panelContentWidthValue(simplePageMaxContentWidth) } : {}) } as CSSProperties
  useEffect(() => {
    void executePanelAuthRequest({ csrfToken: cookie('XSRF-TOKEN'), operation: 'profile-read', panelId, payload: {} }).then((result) => {
      if (!result.ok || typeof result.data !== 'object' || result.data === null || !('values' in result.data) || typeof result.data.values !== 'object' || result.data.values === null || Array.isArray(result.data.values)) setError('The profile could not be loaded.')
      else setValues(result.data.values as Readonly<Record<string, unknown>>)
    })
  }, [panelId])

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setError('')
    setSaved(false)
    const data = new FormData(event.currentTarget)
    const updated = Object.fromEntries(Object.entries(values).map(([field, value]) => [field, typeof value === 'boolean' ? data.get(field) === 'on' : typeof value === 'number' ? Number(data.get(field)) : String(data.get(field) ?? '')]))
    const result = await executePanelAuthRequest({ csrfToken: cookie('XSRF-TOKEN'), operation: 'profile-update', panelId, payload: { values: updated } })
    if (!result.ok) setError('The profile could not be saved.')
    else {
      setValues(Object.freeze(updated))
      setSaved(true)
    }
  }

  return <main className="hp-auth-page" data-holo-panel data-theme={theme} style={style}><ShadcnCard className="hp-auth-card"><ShadcnCardHeader><span className="hp-auth-brand-mark"><ShadcnIcon name="user" /></span><div><p>{brandName}</p><h1>Profile</h1><span>Manage your account information.</span></div></ShadcnCardHeader><ShadcnCardContent><form onSubmit={submit}>{Object.entries(values).map(([field, value]) => <div className="hp-auth-field" key={field}><ShadcnLabel htmlFor={`${panelId}-${field}`}>{label(field)}</ShadcnLabel><ShadcnInput autoComplete={field === 'email' ? 'email' : field === 'name' ? 'name' : undefined} defaultChecked={typeof value === 'boolean' ? value : undefined} defaultValue={typeof value === 'boolean' ? undefined : String(value ?? '')} id={`${panelId}-${field}`} name={field} type={inputType(field, value)} /></div>)}{error ? <p className="hp-auth-error" role="alert">{error}</p> : null}{saved ? <p className="hp-auth-success" role="status">Profile saved.</p> : null}<ShadcnButton className="hp-button hp-button-primary" type="submit">Save changes</ShadcnButton></form></ShadcnCardContent></ShadcnCard></main>
}
