<script lang="ts">
	import { cn, type WithElementRef } from "../../lib/utils.js";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();
</script>

<div
	bind:this={ref}
	data-slot="alert-description"
	class={cn(
		"hp:text-sm hp:text-balance hp:text-muted-foreground hp:md:text-pretty hp:[&_p:not(:last-child)]:mb-4 hp:[&_a]:underline hp:[&_a]:underline-offset-3 hp:[&_a]:hover:text-foreground",
		className
	)}
	{...restProps}
>
	{@render children?.()}
</div>
