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
	data-slot="alert-dialog-footer"
	class={cn(
		"hp:-mx-4 hp:-mb-4 hp:rounded-b-xl hp:border-t hp:bg-muted/50 hp:p-4 hp:flex hp:flex-col-reverse hp:gap-2 hp:group-data-[size=sm]/alert-dialog-content:grid hp:group-data-[size=sm]/alert-dialog-content:grid-cols-2 hp:sm:flex-row hp:sm:justify-end",
		className
	)}
	{...restProps}
>
	{@render children?.()}
</div>
