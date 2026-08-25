let navigate = (_url: string): Promise<void> => Promise.resolve()

export function configureSvelteKitNavigation(handler: (url: string) => Promise<void>): void {
  navigate = handler
}

export async function goto(url: string | URL): Promise<void> {
  await navigate(String(url))
}
