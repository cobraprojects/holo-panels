export type TransportHttpRequest = {
  readonly body: string
  readonly credentials: 'same-origin'
  readonly headers: Readonly<Record<string, string>>
  readonly method: 'POST'
  readonly signal?: AbortSignal
  readonly url: string
}

export type TransportHttpResponse = {
  readonly body: unknown
  readonly status: number
}

export interface TransportAdapter {
  send(request: TransportHttpRequest): Promise<TransportHttpResponse>
}

export class FetchTransportAdapter implements TransportAdapter {
  async send(request: TransportHttpRequest): Promise<TransportHttpResponse> {
    const response = await fetch(request.url, {
      body: request.body,
      credentials: request.credentials,
      headers: request.headers,
      method: request.method,
      signal: request.signal,
    })
    const contents = await response.text()
    let body: unknown
    try {
      body = contents ? JSON.parse(contents) as unknown : undefined
    } catch {
      body = contents
    }
    return Object.freeze({ body, status: response.status })
  }
}
