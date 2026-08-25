<script lang="ts">
  import { Progress as ProgressPrimitive } from 'bits-ui'
  import { cn } from '../../lib/utils'
  import type { ComponentProps } from 'svelte'

  let { class: className, max = 100, value = 0, ...props }: ComponentProps<typeof ProgressPrimitive.Root> = $props()
  const percentage = $derived(Math.max(0, Math.min(100, ((value ?? 0) / max) * 100)))
</script>

<ProgressPrimitive.Root data-slot="progress" class={cn('hp:relative hp:h-2 hp:w-full hp:overflow-hidden hp:rounded-full hp:bg-primary/20', className)} {max} {value} {...props}>
  <div data-slot="progress-indicator" class="hp:h-full hp:w-full hp:flex-1 hp:bg-primary hp:transition-all" style={`transform: translateX(-${100 - percentage}%)`}></div>
</ProgressPrimitive.Root>
