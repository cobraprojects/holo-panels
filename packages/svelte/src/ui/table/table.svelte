<script lang="ts">
	import { cn, type WithElementRef } from "../../lib/utils.js";
	import type { HTMLTableAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLTableAttributes> = $props();
</script>

<div data-slot="table-container" class="hp:relative hp:w-full hp:overflow-x-auto">
	<table bind:this={ref} data-slot="table" class={cn("hp:w-full hp:caption-bottom hp:text-sm", className)} {...restProps}>
		{@render children?.()}
	</table>
</div>
