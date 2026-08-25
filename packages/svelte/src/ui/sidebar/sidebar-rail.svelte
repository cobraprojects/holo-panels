<script lang="ts">
	import { cn, type WithElementRef } from "../../lib/utils.js";
	import { useSidebar } from "./context.svelte.js";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLButtonElement>, HTMLButtonElement> = $props();

	const sidebar = useSidebar();
</script>

<button
	bind:this={ref}
	data-sidebar="rail"
	data-slot="sidebar-rail"
	aria-label="Toggle Sidebar"
	tabindex={-1}
	onclick={sidebar.toggle}
	title="Toggle Sidebar"
	class={cn(
		"hp:hover:after:bg-sidebar-border hp:absolute hp:inset-y-0 hp:z-20 hp:hidden hp:w-4 hp:-translate-x-1/2 hp:transition-all hp:ease-linear hp:group-data-[side=left]:-right-4 hp:group-data-[side=right]:left-0 hp:after:absolute hp:after:inset-y-0 hp:after:left-1/2 hp:after:w-[2px] hp:sm:flex",
		"hp:in-data-[side=left]:cursor-w-resize hp:in-data-[side=right]:cursor-e-resize",
		"hp:[[data-side=left][data-state=collapsed]_&]:cursor-e-resize hp:[[data-side=right][data-state=collapsed]_&]:cursor-w-resize",
		"hp:group-data-[collapsible=offcanvas]:translate-x-0 hp:group-data-[collapsible=offcanvas]:after:left-full hp:hover:group-data-[collapsible=offcanvas]:bg-sidebar",
		"[[data-side=left][data-collapsible=offcanvas]_&]:-right-2",
		"[[data-side=right][data-collapsible=offcanvas]_&]:-left-2",
		className
	)}
	{...restProps}
>
	{@render children?.()}
</button>
