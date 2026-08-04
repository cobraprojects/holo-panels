import type { TransportAdapter, TransportHttpRequest, TransportHttpResponse } from './adapter'

export type FakeTransportStep
  = Readonly<TransportHttpResponse>
  | Error
  | ((request: TransportHttpRequest) => Readonly<TransportHttpResponse> | Promise<Readonly<TransportHttpResponse>>)

function snapshotRequest(request: TransportHttpRequest): TransportHttpRequest {
  return Object.freeze({
    ...request,
    headers: Object.freeze({ ...request.headers }),
  })
}

export class FakeTransportAdapter implements TransportAdapter {
  readonly #requests: TransportHttpRequest[] = []
  readonly #steps: FakeTransportStep[]

  constructor(steps: readonly FakeTransportStep[]) {
    this.#steps = [...steps]
  }

  get requests(): readonly TransportHttpRequest[] {
    return Object.freeze([...this.#requests])
  }

  async send(request: TransportHttpRequest): Promise<TransportHttpResponse> {
    const snapshot = snapshotRequest(request)
    this.#requests.push(snapshot)
    const step = this.#steps.shift()
    if (!step) throw new Error('[Holo Panels] Fake transport has no queued response.')
    if (step instanceof Error) throw step
    return Object.freeze(typeof step === 'function' ? await step(snapshot) : step)
  }
}

export function createTransportRecorder(steps: readonly FakeTransportStep[]): FakeTransportAdapter {
  return new FakeTransportAdapter(steps)
}
