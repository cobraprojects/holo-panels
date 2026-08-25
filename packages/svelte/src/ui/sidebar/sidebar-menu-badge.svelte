<script lang="ts">
	import { cn, type WithElementRef } from "../../lib/utils.js";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLElement>> = $props();
</script>

<div
	bind:this={ref}
	data-slot="sidebar-menu-badge"
	data-sidebar="menu-badge"
	class={cn(
		"hp:pointer-events-none hp:absolute hp:right-1 hp:flex hp:h-5 hp:min-w-5 hp:rounded-md hp:px-1 hp:text-xs hp:font-medium hp:text-sidebar-foreground hp:peer-hover/menu-button:text-sidebar-accent-foreground hp:peer-data-[size=default]/menu-button:top-1.5 hp:peer-data-[size=lg]/menu-button:top-2.5 hp:peer-data-[size=sm]/menu-button:top-1 hp:peer-data-active/menu-button:text-sidebar-accent-foreground hp:flex hp:items-center hp:justify-center hp:tabular-nums hp:select-none hp:group-data-[collapsible=icon]:hidden",
		className
	)}
	{...restProps}
>
	{@render children?.()}
</div>
