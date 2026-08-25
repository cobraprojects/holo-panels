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
	data-slot="field-label"
	class={cn("hp:gap-2 hp:text-sm hp:leading-snug hp:font-medium hp:group-data-[disabled=true]/field:opacity-50 hp:flex hp:w-fit hp:items-center hp:leading-snug", className)}
	{...restProps}
>
	{@render children?.()}
</div>
