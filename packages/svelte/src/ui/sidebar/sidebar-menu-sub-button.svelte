<script lang="ts">
	import { cn, type WithElementRef } from "../../lib/utils.js";
	import type { Snippet } from "svelte";
	import type { HTMLAnchorAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		children,
		child,
		class: className,
		size = "md",
		isActive = false,
		...restProps
	}: WithElementRef<HTMLAnchorAttributes> & {
		child?: Snippet<[{ props: Record<string, unknown> }]>;
		size?: "sm" | "md";
		isActive?: boolean;
	} = $props();

	const mergedProps = $derived({
		class: cn(
			"hp:h-7 hp:gap-2 hp:rounded-md hp:px-2 hp:text-sidebar-foreground hp:ring-sidebar-ring hp:hover:bg-sidebar-accent hp:hover:text-sidebar-accent-foreground hp:focus-visible:ring-2 hp:active:bg-sidebar-accent hp:active:text-sidebar-accent-foreground hp:data-[size=md]:text-sm hp:data-[size=sm]:text-xs hp:data-active:bg-sidebar-accent hp:data-active:text-sidebar-accent-foreground hp:[&>svg]:size-4 hp:[&>svg]:text-sidebar-accent-foreground hp:flex hp:min-w-0 hp:-translate-x-px hp:items-center hp:overflow-hidden hp:outline-hidden hp:group-data-[collapsible=icon]:hidden hp:disabled:pointer-events-none hp:disabled:opacity-50 hp:aria-disabled:pointer-events-none hp:aria-disabled:opacity-50 hp:[&>span:last-child]:truncate hp:[&>svg]:shrink-0",
			className
		),
		"data-slot": "sidebar-menu-sub-button",
		"data-sidebar": "menu-sub-button",
		"data-size": size,
		"data-active": isActive,
		...restProps,
	});
</script>

{#if child}
	{@render child({ props: mergedProps })}
{:else}
	<a bind:this={ref} {...mergedProps}>
		{@render children?.()}
	</a>
{/if}
