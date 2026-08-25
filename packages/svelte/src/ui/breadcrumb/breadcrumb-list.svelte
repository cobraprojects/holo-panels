<script lang="ts">
	import { cn, type WithElementRef } from "../../lib/utils.js";
	import type { HTMLOlAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLOlAttributes> = $props();
</script>

<ol
	bind:this={ref}
	data-slot="breadcrumb-list"
	class={cn("hp:gap-1.5 hp:text-sm hp:text-muted-foreground hp:flex hp:flex-wrap hp:items-center hp:wrap-break-word", className)}
	{...restProps}
>
	{@render children?.()}
</ol>
