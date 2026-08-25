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
	data-slot="alert-dialog-media"
	class={cn("hp:mb-2 hp:inline-flex hp:size-10 hp:items-center hp:justify-center hp:rounded-md hp:bg-muted hp:sm:group-data-[size=default]/alert-dialog-content:row-span-2 hp:*:[svg:not([class*='size-'])]:size-6", className)}
	{...restProps}
>
	{@render children?.()}
</div>
