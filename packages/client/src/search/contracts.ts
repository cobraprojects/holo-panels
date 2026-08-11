export interface ClientSearchAction {
  readonly id: string
  readonly label: string
  readonly url: string
}

export interface ClientSearchResult {
  readonly actions: readonly ClientSearchAction[]
  readonly details: Readonly<Record<string, string>>
  readonly icon: string | null
  readonly id: string
  readonly image: string | null
  readonly resourceId: string
  readonly title: string
  readonly url: string
}

export interface ClientSearchResponse {
  readonly panelId: string
  readonly results: readonly ClientSearchResult[]
  readonly term: string
}

export interface ClientSearchState {
  readonly error: string | null
  readonly loading: boolean
  readonly open: boolean
  readonly results: readonly ClientSearchResult[]
  readonly selectedIndex: number
  readonly term: string
}

export interface ClientSearchTransport {
  search(term: string, signal: AbortSignal): Promise<ClientSearchResponse>
}

export interface ClientSearchOptions {
  readonly debounceMilliseconds?: number
  readonly keybindings?: readonly string[]
  readonly maximumLength?: number
  readonly minimumLength?: number
}

export interface ClientSearchShortcut {
  readonly alt?: boolean
  readonly ctrl: boolean
  readonly meta: boolean
  readonly shift?: boolean
}

export type ClientSearchStateListener = (state: ClientSearchState) => void
