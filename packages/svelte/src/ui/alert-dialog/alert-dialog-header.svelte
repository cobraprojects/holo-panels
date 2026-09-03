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
	data-slot="alert-dialog-header"
	class={cn("hp:grid hp:grid-rows-[auto_1fr] hp:place-items-center hp:gap-1.5 hp:text-center hp:has-data-[slot=alert-dialog-media]:grid-rows-[auto_auto_1fr] hp:has-data-[slot=alert-dialog-media]:gap-x-4 hp:sm:group-data-[size=default]/alert-dialog-content:place-items-start hp:sm:group-data-[size=default]/alert-dialog-content:text-start hp:sm:group-data-[size=default]/alert-dialog-content:has-data-[slot=alert-dialog-media]:grid-rows-[auto_1fr]", className)}
	{...restProps}
>
	{@render children?.()}
</div>
