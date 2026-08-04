export default defineNuxtRouteMiddleware(async (to) => {
  try {
    await useRequestFetch()('/_holo/panels/admin/auth/mfa-status')
  } catch {
    return navigateTo(`/login?next=${encodeURIComponent(to.fullPath)}`, { redirectCode: 307 })
  }
})
