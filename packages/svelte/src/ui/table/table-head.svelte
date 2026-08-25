<script lang="ts">
	import { cn, type WithElementRef } from "../../lib/utils.js";
	import type { HTMLThAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLThAttributes> = $props();
</script>

<th bind:this={ref} data-slot="table-head" class={cn("hp:h-10 hp:px-2 hp:text-left hp:align-middle hp:font-medium hp:whitespace-nowrap hp:text-foreground hp:[&:has([role=checkbox])]:pr-0", className)} {...restProps}>
	{@render children?.()}
</th>
