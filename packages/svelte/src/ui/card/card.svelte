<script lang="ts">
	import { cn, type WithElementRef } from "../../lib/utils.js";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: className,
		children,
		size = "default",
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & { size?: "default" | "sm" } = $props();
</script>

<div
	bind:this={ref}
	data-slot="card"
	data-size={size}
	class={cn("hp:gap-(--card-spacing) hp:overflow-hidden hp:rounded-xl hp:bg-card hp:py-(--card-spacing) hp:text-sm hp:text-card-foreground hp:ring-1 hp:ring-foreground/10 hp:[--card-spacing:--spacing(4)] hp:has-data-[slot=card-footer]:pb-0 hp:has-[>img:first-child]:pt-0 hp:data-[size=sm]:[--card-spacing:--spacing(3)] hp:data-[size=sm]:has-data-[slot=card-footer]:pb-0 hp:*:[img:first-child]:rounded-t-xl hp:*:[img:last-child]:rounded-b-xl hp:group/card hp:flex hp:flex-col", className)}
	{...restProps}
>
	{@render children?.()}
</div>
