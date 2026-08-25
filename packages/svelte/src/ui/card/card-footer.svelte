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
	data-slot="card-footer"
	class={cn("hp:rounded-b-xl hp:border-t hp:bg-muted/50 hp:p-(--card-spacing) hp:flex hp:items-center", className)}
	{...restProps}
>
	{@render children?.()}
</div>
