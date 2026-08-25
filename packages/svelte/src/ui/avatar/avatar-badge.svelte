<script lang="ts">
	import { cn, type WithElementRef } from "../../lib/utils.js";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLSpanElement>> = $props();
</script>

<span
	bind:this={ref}
	data-slot="avatar-badge"
	class={cn(
		"hp:bg-primary hp:text-primary-foreground hp:ring-background hp:absolute hp:right-0 hp:bottom-0 hp:z-10 hp:inline-flex hp:items-center hp:justify-center hp:rounded-full hp:bg-blend-color hp:ring-2 hp:select-none",
		"hp:group-data-[size=sm]/avatar:size-2 hp:group-data-[size=sm]/avatar:[&>svg]:hidden",
		"hp:group-data-[size=default]/avatar:size-2.5 hp:group-data-[size=default]/avatar:[&>svg]:size-2",
		"hp:group-data-[size=lg]/avatar:size-3 hp:group-data-[size=lg]/avatar:[&>svg]:size-2",
		className
	)}
	{...restProps}
>
	{@render children?.()}
</span>
