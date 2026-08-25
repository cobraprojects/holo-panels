<script lang="ts">
	import { Skeleton } from "../skeleton/index.js";
	import { cn, type WithElementRef } from "../../lib/utils.js";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: className,
		showIcon = false,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLElement>> & {
		showIcon?: boolean;
	} = $props();

	// Random width between 50% and 90%
	const width = `${Math.floor(Math.random() * 40) + 50}%`;
</script>

<div
	bind:this={ref}
	data-slot="sidebar-menu-skeleton"
	data-sidebar="menu-skeleton"
	class={cn("hp:h-8 hp:gap-2 hp:rounded-md hp:px-2 hp:flex hp:items-center", className)}
	{...restProps}
>
	{#if showIcon}
		<Skeleton class="hp:size-4 hp:rounded-md" data-sidebar="menu-skeleton-icon" />
	{/if}
	<Skeleton
		class="hp:h-4 hp:max-w-(--skeleton-width) hp:flex-1"
		data-sidebar="menu-skeleton-text"
		style="--skeleton-width: {width};"
	/>
	{@render children?.()}
</div>
