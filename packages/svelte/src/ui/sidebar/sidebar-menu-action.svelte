<script lang="ts">
	import { cn, type WithElementRef } from "../../lib/utils.js";
	import type { Snippet } from "svelte";
	import type { HTMLButtonAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: className,
		showOnHover = false,
		children,
		child,
		...restProps
	}: WithElementRef<HTMLButtonAttributes> & {
		child?: Snippet<[{ props: Record<string, unknown> }]>;
		showOnHover?: boolean;
	} = $props();

	const mergedProps = $derived({
		class: cn(
			"hp:absolute hp:top-1.5 hp:right-1 hp:aspect-square hp:w-5 hp:rounded-md hp:p-0 hp:text-sidebar-foreground hp:ring-sidebar-ring hp:peer-hover/menu-button:text-sidebar-accent-foreground hp:peer-data-[size=default]/menu-button:top-1.5 hp:peer-data-[size=lg]/menu-button:top-2.5 hp:peer-data-[size=sm]/menu-button:top-1 hp:hover:bg-sidebar-accent hp:hover:text-sidebar-accent-foreground hp:focus-visible:ring-2 hp:[&>svg]:size-4 hp:flex hp:items-center hp:justify-center hp:outline-hidden hp:transition-transform hp:group-data-[collapsible=icon]:hidden hp:after:absolute hp:after:-inset-2 hp:md:after:hidden hp:[&>svg]:shrink-0",
			showOnHover &&
				"hp:group-focus-within/menu-item:opacity-100 hp:group-hover/menu-item:opacity-100 hp:peer-data-active/menu-button:text-sidebar-accent-foreground hp:md:opacity-0 hp:data-open:opacity-100",
			className
		),
		"data-slot": "sidebar-menu-action",
		"data-sidebar": "menu-action",
		...restProps,
	});
</script>

{#if child}
	{@render child({ props: mergedProps })}
{:else}
	<button bind:this={ref} {...mergedProps}>
		{@render children?.()}
	</button>
{/if}
