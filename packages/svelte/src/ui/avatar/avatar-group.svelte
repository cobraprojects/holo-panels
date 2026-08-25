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
	data-slot="avatar-group"
	class={cn(
		"hp:cn-avatar-group hp:group/avatar-group hp:flex hp:-space-x-2 hp:*:data-[slot=avatar]:ring-2 hp:*:data-[slot=avatar]:ring-background",
		className
	)}
	{...restProps}
>
	{@render children?.()}
</div>
