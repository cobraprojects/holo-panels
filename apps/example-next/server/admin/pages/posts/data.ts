import { PanelRuntimeError, ResourceExecutor, type ResourceExecutionContext } from '@holo-js/panels'
import PostResource from '../../resources/posts/PostResource'
import { canManagePosts, type AdminActor, type PostRecord } from './access'

const definition = PostResource.compile()

export function requirePostActor(actor: object | null): asserts actor is AdminActor {
  const id = actor && Reflect.get(actor, 'id')
  const role = actor && Reflect.get(actor, 'role')
  if ((typeof id !== 'string' && typeof id !== 'number') || typeof role !== 'string' || !canManagePosts({ id, role })) {
    throw new PanelRuntimeError('access-denied', 'Policy denied this Post operation.')
  }
}

const authorization = {
  async authorizeClass(actor: object | null): Promise<void> {
    requirePostActor(actor)
  },
  async authorizeRecord(actor: object | null): Promise<void> {
    requirePostActor(actor)
  },
}

const postExecutor = new ResourceExecutor(definition, { authorization })

export function postExecutionContext(actor: object | null, signal: AbortSignal, tenant: unknown): ResourceExecutionContext<AdminActor, string> {
  requirePostActor(actor)
  if (typeof tenant !== 'string' || !tenant) throw new Error('A tenant is required for Post operations.')
  return { actor, signal, tenant }
}

function postRecord(value: Readonly<Record<string, unknown>>): PostRecord {
  const category = value.category
  const city = value.city
  const id = value.id
  const slug = value.slug
  const title = value.title
  if (typeof category !== 'string' || typeof city !== 'string' || (typeof id !== 'number' && typeof id !== 'string') || typeof slug !== 'string' || typeof title !== 'string') {
    throw new Error('The Post record could not be presented.')
  }
  return { category, city, id, slug, title }
}

export async function loadPostRecord(recordId: number | string, context: ResourceExecutionContext<AdminActor, string>): Promise<PostRecord> {
  return postRecord(await postExecutor.serialize(recordId, context))
}

export async function loadPostRecords(context: ResourceExecutionContext<AdminActor, string>): Promise<PostRecord[]> {
  await authorization.authorizeClass(context.actor)
  if (context.signal.aborted) throw context.signal.reason
  let query = definition.baseQuery(definition.model.query(), context)
  if (definition.tenantScope) query = definition.tenantScope(query, context)
  return (await query.get()).map((record: { toJSON(): Readonly<Record<string, unknown>> }) => postRecord(record.toJSON()))
}

export async function mutatePost(
  intent: string,
  recordId: number | string | null,
  values: Readonly<Record<string, string>>,
  context: ResourceExecutionContext<AdminActor, string>,
): Promise<void> {
  if (intent === 'delete') {
    if (recordId === null) throw new Error('A Post record ID is required for deletion.')
    await postExecutor.delete(recordId, context)
  } else if (recordId !== null) {
    await postExecutor.update(recordId, values, context)
  } else {
    await postExecutor.create(values, context)
  }
}
