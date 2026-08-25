<script lang="ts">
	import { cn, type WithElementRef } from "../../lib/utils.js";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLSpanElement>> = $props();
</script>

<span
	bind:this={ref}
	class={cn("hp:gap-2 hp:text-sm hp:text-muted-foreground hp:[&_svg:not([class*='size-'])]:size-4 hp:flex hp:items-center hp:[&_svg]:pointer-events-none", className)}
	{...restProps}
>
	{@render children?.()}
</span>
