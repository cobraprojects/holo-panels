<script lang="ts">
	import { cn, type WithElementRef, type WithoutChildren } from "../../lib/utils.js";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: WithoutChildren<WithElementRef<HTMLAttributes<HTMLDivElement>>> = $props();
</script>

<div
	bind:this={ref}
	data-slot="skeleton"
	class={cn("hp:rounded-md hp:bg-muted hp:animate-pulse", className)}
	{...restProps}
></div>
