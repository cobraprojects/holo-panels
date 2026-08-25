<script lang="ts">
	import { cn, type WithElementRef } from "../../lib/utils.js";
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		children,
		child,
		class: className,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLElement>> & {
		child?: Snippet<[{ props: Record<string, unknown> }]>;
	} = $props();

	const mergedProps = $derived({
		class: cn(
			"hp:h-8 hp:rounded-md hp:px-2 hp:text-xs hp:font-medium hp:text-sidebar-foreground/70 hp:ring-sidebar-ring hp:transition-[margin,opacity] hp:duration-200 hp:ease-linear hp:group-data-[collapsible=icon]:-mt-8 hp:group-data-[collapsible=icon]:opacity-0 hp:focus-visible:ring-2 hp:[&>svg]:size-4 hp:flex hp:shrink-0 hp:items-center hp:outline-hidden hp:[&>svg]:shrink-0",
			className
		),
		"data-slot": "sidebar-group-label",
		"data-sidebar": "hp:group-label",
		...restProps,
	});
</script>

{#if child}
	{@render child({ props: mergedProps })}
{:else}
	<div bind:this={ref} {...mergedProps}>
		{@render children?.()}
	</div>
{/if}
