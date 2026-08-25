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
	data-slot="field-group"
	class={cn(
		"hp:gap-5 hp:data-[slot=checkbox-group]:gap-3 hp:*:data-[slot=field-group]:gap-4 hp:group/field-group hp:@container/field-group hp:flex hp:w-full hp:flex-col",
		className
	)}
	{...restProps}
>
	{@render children?.()}
</div>
