<script lang="ts">
	import { cn, type WithElementRef } from "../../lib/utils.js";
	import type { HTMLTdAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLTdAttributes> = $props();
</script>

<td bind:this={ref} data-slot="table-cell" class={cn("hp:px-3 hp:py-2 hp:align-middle hp:whitespace-nowrap hp:[&:has([role=checkbox])]:pr-0", className)} {...restProps}>
	{@render children?.()}
</td>
