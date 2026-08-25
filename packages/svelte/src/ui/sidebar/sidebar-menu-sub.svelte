<script lang="ts">
	import { cn, type WithElementRef } from "../../lib/utils.js";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLUListElement>> = $props();
</script>

<ul
	bind:this={ref}
	data-slot="sidebar-menu-sub"
	data-sidebar="menu-sub"
	class={cn("hp:mx-3.5 hp:translate-x-px hp:gap-1 hp:border-l hp:border-sidebar-border hp:px-2.5 hp:py-0.5 hp:group-data-[collapsible=icon]:hidden hp:flex hp:min-w-0 hp:flex-col", className)}
	{...restProps}
>
	{@render children?.()}
</ul>
