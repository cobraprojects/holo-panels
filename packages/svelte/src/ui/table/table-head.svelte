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

<th bind:this={ref} data-slot="table-head" class={cn("hp:h-9 hp:px-3 hp:text-left hp:align-middle hp:text-xs hp:font-medium hp:whitespace-nowrap hp:text-muted-foreground hp:[&:has([role=checkbox])]:pr-0", className)} {...restProps}>
	{@render children?.()}
</th>
