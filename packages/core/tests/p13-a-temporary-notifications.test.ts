import { describe, expect, it } from 'vitest'
import { panelNotification } from '../src/notifications/notification'

describe('P13-A panel notification presentation', () => {
  it('builds every temporary presentation field fluently and freezes snapshots', () => {
    const builder = panelNotification('post.saved')
      .title(' Post saved ')
      .body(' Ready to publish ')
      .status('success')
      .icon('check')
      .color('#16a34a')
      .duration(8_000)
      .closeable(false)
      .action('open', 'Open post', 'navigate', 'https://example.com/posts/1')
      .action('dismiss', 'Dismiss', 'dismiss')
    const presentation = builder.presentation()

    expect(presentation).toEqual({
      actions: [
        { id: 'open', kind: 'navigate', label: 'Open post', url: 'https://example.com/posts/1' },
        { id: 'dismiss', kind: 'dismiss', label: 'Dismiss', url: null },
      ],
      body: 'Ready to publish',
      closeable: false,
      color: '#16a34a',
      duration: 8_000,
      icon: 'check',
      id: 'post.saved',
      persistent: false,
      status: 'success',
      title: 'Post saved',
    })
    expect(Object.isFrozen(presentation)).toBe(true)
    expect(Object.isFrozen(presentation.actions)).toBe(true)
  })

  it('keeps persistent and duration state consistent across fluent reconfiguration', () => {
    const presentation = panelNotification('job.finished')
      .title('Job finished')
      .persistent()
      .duration(2_000)
      .presentation()

    expect(presentation).toMatchObject({ duration: 2_000, persistent: false })
    expect(panelNotification('job.waiting').title('Job waiting').duration(null).persistent().presentation()).toMatchObject({
      duration: null,
      persistent: true,
    })
  })

  it('rejects duplicate actions, invalid runtime status, unsafe URLs, and invalid bounds', () => {
    expect(() => panelNotification('invalid').title('Invalid').status('other' as 'info')).toThrow('Unknown notification status')
    expect(() => panelNotification('invalid').title('Invalid').duration(999)).toThrow('between 1000 and 300000')
    expect(() => panelNotification('invalid').title('Invalid').action('open', 'Open', 'navigate', 'javascript:alert(1)')).toThrow('credential-free HTTP URLs')
    expect(() => panelNotification('invalid').title('Invalid').action('open', 'Open', 'navigate', '/\\evil.example')).toThrow('credential-free HTTP URLs')
    expect(() => panelNotification('invalid').title('Invalid').action('open', 'Open', 'navigate', 'https://user:secret@example.com')).toThrow('credential-free HTTP URLs')
    expect(() => panelNotification('invalid').title('Invalid').action('open', 'Open', 'navigate', 'https://example.com/\\attacker')).toThrow('credential-free HTTP URLs')
    expect(() => panelNotification('invalid').title('Invalid').action('open', 'Open', 'navigate', 'https://example.com/\nattacker')).toThrow('credential-free HTTP URLs')
    expect(() => panelNotification('invalid').title('Invalid').action('open', 'Open', 'navigate', '\nhttps://example.com')).toThrow('credential-free HTTP URLs')
    expect(() => panelNotification('invalid').title('Invalid').action('open', 'Open', 'navigate', 'https://')).toThrow('credential-free HTTP URLs')
    expect(() => panelNotification('invalid').title('Invalid').action('same', 'One', 'dismiss').action('same', 'Two', 'dismiss')).toThrow('Duplicate')
  })
})
