<script lang="ts">
	import { cn, type WithElementRef } from '../../lib/utils.js'
	import { type HTMLAttributes, type HTMLTableAttributes } from 'svelte/elements'

	let {
		ref = $bindable(null),
		class: className,
		containerProps,
		children,
		...restProps
	}: WithElementRef<HTMLTableAttributes> & { readonly containerProps?: HTMLAttributes<HTMLDivElement> } = $props()
</script>

<div {...containerProps} data-slot="table-container" class={cn('hp:relative hp:w-full hp:overflow-x-auto', containerProps?.class)}>
	<table bind:this={ref} data-slot="table" class={cn("hp:w-full hp:caption-bottom hp:text-sm", className)} {...restProps}>
		{@render children?.()}
	</table>
</div>
