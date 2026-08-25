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
	data-slot="alert-title"
	class={cn(
		"hp:font-medium hp:group-has-[>svg]/alert:col-start-2 hp:[&_a]:underline hp:[&_a]:underline-offset-3 hp:[&_a]:hover:text-foreground",
		className
	)}
	{...restProps}
>
	{@render children?.()}
</div>
