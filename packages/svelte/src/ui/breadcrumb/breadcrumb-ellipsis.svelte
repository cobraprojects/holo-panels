<script lang="ts">
	import MoreHorizontalIcon from '@lucide/svelte/icons/more-horizontal';
	import { cn, type WithElementRef, type WithoutChildren } from "../../lib/utils.js";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: WithoutChildren<WithElementRef<HTMLAttributes<HTMLSpanElement>>> = $props();
</script>

<span
	bind:this={ref}
	data-slot="breadcrumb-ellipsis"
	role="presentation"
	aria-hidden="true"
	class={cn("hp:size-5 hp:[&>svg]:size-4 hp:flex hp:items-center hp:justify-center", className)}
	{...restProps}
>
	<MoreHorizontalIcon  />
	<span class="hp:sr-only">More</span>
</span>
