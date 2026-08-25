<script lang="ts">
  import Archive from 'lucide-svelte/icons/archive'
  import Bell from 'lucide-svelte/icons/bell'
  import Check from 'lucide-svelte/icons/check'
  import Circle from 'lucide-svelte/icons/circle'
  import Copy from 'lucide-svelte/icons/copy'
  import Download from 'lucide-svelte/icons/download'
  import Eye from 'lucide-svelte/icons/eye'
  import Link2 from 'lucide-svelte/icons/link-2'
  import Pencil from 'lucide-svelte/icons/pencil'
  import Play from 'lucide-svelte/icons/play'
  import Plus from 'lucide-svelte/icons/plus'
  import RotateCcw from 'lucide-svelte/icons/rotate-ccw'
  import Trash2 from 'lucide-svelte/icons/trash-2'
  import Unlink from 'lucide-svelte/icons/unlink'
  import Upload from 'lucide-svelte/icons/upload'
  import User from 'lucide-svelte/icons/user'
  import X from 'lucide-svelte/icons/x'

  let { name }: { readonly name: string } = $props()
</script>

{#if name === 'archive'}<Archive aria-hidden="true" data-icon={name} data-slot="icon" />
{:else if name === 'bell'}<Bell aria-hidden="true" data-icon={name} data-slot="icon" />
{:else if name === 'check'}<Check aria-hidden="true" data-icon={name} data-slot="icon" />
{:else if name === 'close'}<X aria-hidden="true" data-icon={name} data-slot="icon" />
{:else if name === 'copy'}<Copy aria-hidden="true" data-icon={name} data-slot="icon" />
{:else if name === 'delete'}<Trash2 aria-hidden="true" data-icon={name} data-slot="icon" />
{:else if name === 'download'}<Download aria-hidden="true" data-icon={name} data-slot="icon" />
{:else if name === 'edit'}<Pencil aria-hidden="true" data-icon={name} data-slot="icon" />
{:else if name === 'link'}<Link2 aria-hidden="true" data-icon={name} data-slot="icon" />
{:else if name === 'play'}<Play aria-hidden="true" data-icon={name} data-slot="icon" />
{:else if name === 'plus'}<Plus aria-hidden="true" data-icon={name} data-slot="icon" />
{:else if name === 'restore'}<RotateCcw aria-hidden="true" data-icon={name} data-slot="icon" />
{:else if name === 'upload'}<Upload aria-hidden="true" data-icon={name} data-slot="icon" />
{:else if name === 'unlink'}<Unlink aria-hidden="true" data-icon={name} data-slot="icon" />
{:else if name === 'user'}<User aria-hidden="true" data-icon={name} data-slot="icon" />
{:else if name === 'view'}<Eye aria-hidden="true" data-icon={name} data-slot="icon" />
{:else}<Circle aria-hidden="true" data-icon={name} data-slot="icon" />{/if}
