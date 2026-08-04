import type {
  CloseModalEffect,
  DownloadEffect,
  FocusEffect,
  InvalidateTableEffect,
  RedirectEffect,
  RefreshEffect,
} from '@holo-js/panels-core'
import type { ClientToastStore } from '../notifications'

export type ClientEffectHandler<TEffect> = (effect: Readonly<TEffect>) => void | Promise<void>

export interface ClientEffectSessionOptions {
  readonly panelId: string
  readonly toastStore: ClientToastStore
  readonly redirect?: ClientEffectHandler<RedirectEffect>
  readonly closeModal?: ClientEffectHandler<CloseModalEffect>
  readonly refresh?: ClientEffectHandler<RefreshEffect>
  readonly invalidateTable?: ClientEffectHandler<InvalidateTableEffect>
  readonly download?: ClientEffectHandler<DownloadEffect>
  readonly focus?: ClientEffectHandler<FocusEffect>
}
