<script lang="ts">
	import { cn, type WithElementRef } from "../../lib/utils.js";
	import type { Snippet } from "svelte";
	import type { HTMLButtonAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: className,
		children,
		child,
		...restProps
	}: WithElementRef<HTMLButtonAttributes> & {
		child?: Snippet<[{ props: Record<string, unknown> }]>;
	} = $props();

	const mergedProps = $derived({
		class: cn(
			"hp:absolute hp:top-3.5 hp:right-3 hp:w-5 hp:rounded-md hp:p-0 hp:text-sidebar-foreground hp:ring-sidebar-ring hp:hover:bg-sidebar-accent hp:hover:text-sidebar-accent-foreground hp:focus-visible:ring-2 hp:[&>svg]:size-4 hp:flex hp:aspect-square hp:items-center hp:justify-center hp:outline-hidden hp:transition-transform hp:group-data-[collapsible=icon]:hidden hp:after:absolute hp:after:-inset-2 hp:md:after:hidden hp:[&>svg]:shrink-0",
			className
		),
		"data-slot": "sidebar-group-action",
		"data-sidebar": "hp:group-action",
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
