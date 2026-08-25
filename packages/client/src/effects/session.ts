import {
  panelNotification,
  type Effect,
  type PanelNotificationPresentation,
  type ResponseEnvelope,
  type ToastEffect,
} from '@holo-js/panels-core'
import type { ClientEffectHandler, ClientEffectSessionOptions } from './contracts'

type LegacyToastEffect = Extract<ToastEffect, { readonly message: string }>
type RichToastEffect = Extract<ToastEffect, { readonly presentation: PanelNotificationPresentation }>

const PANEL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/u

function legacyIdentifierSegment(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '')
  return normalized.slice(0, 80) || 'unknown'
}

function legacyPresentation(
  panelId: string,
  responseId: string,
  index: number,
  effect: Readonly<LegacyToastEffect>,
) {
  const notification = panelNotification(
    `response.${legacyIdentifierSegment(panelId)}.${legacyIdentifierSegment(responseId)}.${index + 1}`,
  )
    .title(effect.title ?? effect.message)
    .body(effect.title ? effect.message : null)
    .status(effect.level)

  if (effect.duration === 0) {
    notification.persistent()
  } else if (typeof effect.duration === 'number') {
    notification.duration(Math.min(300_000, Math.max(1_000, effect.duration)))
  }

  return notification.presentation()
}

function isRichToast(effect: Readonly<ToastEffect>): effect is Readonly<RichToastEffect> {
  return 'presentation' in effect
}

export class ClientEffectSession {
  readonly #activeResponses = new Map<string, Promise<void>>()
  readonly #options: ClientEffectSessionOptions
  readonly #responseProgress = new Map<string, {
    readonly effects: readonly { readonly effect: Readonly<Effect>, readonly originalIndex: number }[]
    nextIndex: number
  }>()
  #disposed = false

  constructor(options: ClientEffectSessionOptions) {
    if (!PANEL_ID_PATTERN.test(options.panelId)) {
      throw new Error('[Holo Panels] Effect session panel IDs must be canonical identifiers.')
    }
    this.#options = Object.freeze({ ...options })
  }

  async apply(response: Readonly<ResponseEnvelope>): Promise<void> {
    if (this.#disposed) return
    const active = this.#activeResponses.get(response.id)
    if (active) return await active

    const progress = this.#responseProgress.get(response.id) ?? {
      effects: Object.freeze([
        ...response.effects
          .map((effect, originalIndex) => ({ effect, originalIndex }))
          .filter(entry => entry.effect.kind !== 'redirect'),
        ...response.effects
          .map((effect, originalIndex) => ({ effect, originalIndex }))
          .filter(entry => entry.effect.kind === 'redirect'),
      ]),
      nextIndex: 0,
    }
    this.#responseProgress.set(response.id, progress)
    if (progress.nextIndex >= progress.effects.length) return

    const execution = this.applyRemaining(response.id, progress)
    this.#activeResponses.set(response.id, execution)
    try {
      await execution
    } finally {
      this.#activeResponses.delete(response.id)
    }
  }

  dispose(): void {
    if (this.#disposed) return
    this.#disposed = true
    this.#activeResponses.clear()
    this.#responseProgress.clear()
    this.#options.toastStore.dispose()
  }

  private async applyRemaining(
    responseId: string,
    progress: {
      readonly effects: readonly { readonly effect: Readonly<Effect>, readonly originalIndex: number }[]
      nextIndex: number
    },
  ): Promise<void> {
    while (progress.nextIndex < progress.effects.length) {
      const entry = progress.effects[progress.nextIndex]!
      await this.applyEffect(entry.effect, responseId, entry.originalIndex)
      progress.nextIndex++
      if (this.#disposed) return
    }
  }

  private async applyEffect(effect: Readonly<Effect>, responseId: string, index: number): Promise<void> {
    switch (effect.kind) {
      case 'toast':
        this.#options.toastStore.push(
          isRichToast(effect)
            ? effect.presentation
            : legacyPresentation(this.#options.panelId, responseId, index, effect),
        )
        return
      case 'close-modal':
        return await this.requireHandler('close-modal', this.#options.closeModal, effect)
      case 'refresh':
        return await this.requireHandler('refresh', this.#options.refresh, effect)
      case 'invalidate-table':
        return await this.requireHandler('invalidate-table', this.#options.invalidateTable, effect)
      case 'download':
        return await this.requireHandler('download', this.#options.download, effect)
      case 'focus':
        return await this.requireHandler('focus', this.#options.focus, effect)
      case 'redirect':
        return await this.requireHandler('redirect', this.#options.redirect, effect)
      default:
        throw new Error(`[Holo Panels] Unsupported client effect: ${String((effect as { readonly kind?: unknown }).kind)}.`)
    }
  }

  private async requireHandler<TEffect>(
    kind: string,
    handler: ClientEffectHandler<TEffect> | undefined,
    effect: Readonly<TEffect>,
  ): Promise<void> {
    if (!handler) throw new Error(`[Holo Panels] No client handler is configured for the "${kind}" effect.`)
    await handler(effect)
  }
}
