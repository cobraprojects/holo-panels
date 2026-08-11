<script lang="ts">
  interface Props { 'aria-hidden'?: 'true'; class?: string; name: string }
  let { class: className = '', name }: Props = $props()
  const iconPaths: Readonly<Record<string, readonly string[]>> = {
    check: ['m5 12 4 4L19 6'],
    chat: ['M21 15a4 4 0 0 1-4 4H8l-5 3 1.7-5.1A8 8 0 1 1 21 15Z'],
    document: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z', 'M14 2v6h6'],
    'document-text': ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z', 'M14 2v6h6', 'M8 13h8', 'M8 17h8'],
    folder: ['M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2Z'],
    home: ['M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3Z'],
    image: ['M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z', 'm3 17 5-5 4 4 2-2 7 7'],
    key: ['M21 2 9.6 13.4', 'M15.5 7.5 18 10', 'M12 10l2 2', 'M5 22a3 3 0 1 1 2.1-5.1A3 3 0 0 1 5 22Z'],
    link: ['M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7L12 5', 'M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7L12 19'],
    menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
    monitor: ['M2 3h20v14H2Z', 'M8 21h8', 'M12 17v4'],
    moon: ['M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z'],
    search: ['M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z', 'm21 21-4.35-4.35'],
    tag: ['M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4Z', 'M7.5 7.5h.01'],
    sun: ['M12 2v2', 'M12 20v2', 'm4.93 4.93 1.41-1.41', 'm5.66 14.14 1.41-1.41', 'M2 12h2', 'M20 12h2', 'm6.34 17.66-1.41 1.41', 'm19.07 4.93-1.41 1.41', 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z'],
    user: ['M20 21a8 8 0 0 0-16 0', 'M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z'],
    users: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M22 21v-2a4 4 0 0 0-3-3.9', 'M16 3.1a4 4 0 0 1 0 7.8'],
  }
  const normalized = $derived(name === 'chat-bubble-left' || name === 'chat-bubble-left-right' ? 'chat' : name === 'photo' ? 'image' : name)
  const paths = $derived(iconPaths[normalized] ?? iconPaths.document!)
</script>

<svg aria-hidden="true" class={className} data-icon={normalized} data-slot="icon" fill="none" height="24" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="24">{#each paths as path (path)}<path d={path}></path>{/each}</svg>
