import type { UploadEndpointRequest, UploadEndpointResponse } from './contracts'
import type { TemporaryUploadService } from './service'

export async function handleUploadEndpoint(
  service: TemporaryUploadService,
  request: UploadEndpointRequest,
): Promise<UploadEndpointResponse> {
  if (!request.csrfVerified) throw new Error('Temporary upload endpoint requires verified CSRF protection')
  const { body, context } = request
  if (body.action === 'create') {
    return await service.create({
      ...context,
      declaredMimeType: body.declaredMimeType,
      name: body.name,
      size: body.size,
    })
  }
  if (body.action === 'write') {
    return await service.write({
      ...context,
      contents: body.contents,
      id: body.id,
      token: body.token,
    })
  }
  if (body.action === 'resolve') {
    return await service.resolve({ ...context, id: body.id, token: body.token })
  }
  await service.delete({ ...context, id: body.id, token: body.token })
  return Object.freeze({ deleted: true })
}
