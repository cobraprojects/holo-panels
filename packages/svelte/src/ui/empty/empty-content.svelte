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
	data-slot="empty-content"
	class={cn(
		"hp:gap-2.5 hp:text-sm hp:flex hp:w-full hp:max-w-sm hp:min-w-0 hp:flex-col hp:items-center hp:text-balance",
		className
	)}
	{...restProps}
>
	{@render children?.()}
</div>
