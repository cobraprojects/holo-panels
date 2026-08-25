<script lang="ts">
	import { cn, type WithElementRef } from "../../lib/utils.js";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: className,
		inset,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
		inset?: boolean;
	} = $props();
</script>

<div
	bind:this={ref}
	data-slot="dropdown-menu-label"
	data-inset={inset}
	class={cn("hp:px-1.5 hp:py-1 hp:text-xs hp:font-medium hp:text-muted-foreground hp:data-inset:pl-7 hp:data-[inset]:pl-8", className)}
	{...restProps}
>
	{@render children?.()}
</div>
