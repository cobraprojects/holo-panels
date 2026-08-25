<script lang="ts">
	import { cn, type WithElementRef } from "../../lib/utils.js";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();
</script>

<div
	bind:this={ref}
	data-slot="card-action"
	class={cn(
		"hp:cn-card-action hp:col-start-2 hp:row-span-2 hp:row-start-1 hp:self-start hp:justify-self-end",
		className
	)}
	{...restProps}
>
	{@render children?.()}
</div>
