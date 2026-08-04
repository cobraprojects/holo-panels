import type {
  NotificationBuildFactories,
  NotificationDefinition,
  NotificationDispatchResult,
} from '@holo-js/notifications'
import type {
  TransferCompletionNotifier,
  TransferExecutionContext,
  TransferOperationRecord,
} from './contracts'

export interface HoloTransferNotificationDefinitions<
  TCompletedActor extends object,
  TCompletedBuild extends NotificationBuildFactories<TCompletedActor>,
  TFailedActor extends object,
  TFailedBuild extends NotificationBuildFactories<TFailedActor>,
> {
  completed(operation: TransferOperationRecord): NotificationDefinition<TCompletedActor, TCompletedBuild>
  failed(operation: TransferOperationRecord): NotificationDefinition<TFailedActor, TFailedBuild>
}

export interface HoloTransferCompletionNotifier<TActor extends object> {
  completed<TTenant>(
    operation: TransferOperationRecord,
    context: TransferExecutionContext<TActor, TTenant>,
    deduplicationKey: string,
  ): Promise<void>
  failed<TTenant>(
    operation: TransferOperationRecord,
    context: TransferExecutionContext<TActor, TTenant>,
    deduplicationKey: string,
  ): Promise<void>
}

function assertNotificationDispatch(result: NotificationDispatchResult): void {
  if (!result.channels.some(channel => !channel.success)) return
  const error = Object.assign(new Error('[Holo Panels] Transfer notification dispatch failed.'), {
    code: 'notification_dispatch_failed',
  })
  throw error
}

export function holoTransferCompletionNotifier<
  TCompletedActor extends object,
  TCompletedBuild extends NotificationBuildFactories<TCompletedActor>,
  TFailedActor extends object,
  TFailedBuild extends NotificationBuildFactories<TFailedActor>,
>(definitions: HoloTransferNotificationDefinitions<
  TCompletedActor,
  TCompletedBuild,
  TFailedActor,
  TFailedBuild
>): HoloTransferCompletionNotifier<
  TCompletedActor & TFailedActor
> {
  type TActor = TCompletedActor & TFailedActor

  return Object.freeze({
    async completed<TTenant>(
      operation: TransferOperationRecord,
      context: TransferExecutionContext<TActor, TTenant>,
      deduplicationKey: string,
    ): Promise<void> {
      const { notify } = await import('@holo-js/notifications')
      const result = await notify(context.actor, definitions.completed(operation))
        .deduplicate(deduplicationKey)
        .dispatch()
      assertNotificationDispatch(result)
    },
    async failed<TTenant>(
      operation: TransferOperationRecord,
      context: TransferExecutionContext<TActor, TTenant>,
      deduplicationKey: string,
    ): Promise<void> {
      const { notify } = await import('@holo-js/notifications')
      const result = await notify(context.actor, definitions.failed(operation))
        .deduplicate(deduplicationKey)
        .dispatch()
      assertNotificationDispatch(result)
    },
  }) satisfies TransferCompletionNotifier<TActor, object>
}
