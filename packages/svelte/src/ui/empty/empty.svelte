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
	data-slot="empty"
	class={cn(
		"hp:gap-4 hp:rounded-xl hp:border-dashed hp:p-6 hp:flex hp:w-full hp:min-w-0 hp:flex-1 hp:flex-col hp:items-center hp:justify-center hp:text-center hp:text-balance",
		className
	)}
	{...restProps}
>
	{@render children?.()}
</div>
