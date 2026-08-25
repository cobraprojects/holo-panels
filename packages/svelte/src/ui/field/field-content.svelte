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
	data-slot="field-content"
	class={cn("hp:gap-0.5 hp:group/field-content hp:flex hp:flex-1 hp:flex-col hp:leading-snug", className)}
	{...restProps}
>
	{@render children?.()}
</div>
