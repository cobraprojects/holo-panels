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
	data-slot="avatar-group-count"
	class={cn(
		"hp:size-8 hp:rounded-full hp:bg-muted hp:text-sm hp:text-muted-foreground hp:group-has-data-[size=lg]/avatar-group:size-10 hp:group-has-data-[size=sm]/avatar-group:size-6 hp:[&>svg]:size-4 hp:group-has-data-[size=lg]/avatar-group:[&>svg]:size-5 hp:group-has-data-[size=sm]/avatar-group:[&>svg]:size-3 hp:relative hp:flex hp:shrink-0 hp:items-center hp:justify-center hp:ring-2 hp:ring-background",
		className
	)}
	{...restProps}
>
	{@render children?.()}
</div>
