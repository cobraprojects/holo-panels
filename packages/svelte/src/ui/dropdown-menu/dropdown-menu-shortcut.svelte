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
	data-slot="dropdown-menu-shortcut"
	class={cn("hp:ms-auto hp:text-xs hp:tracking-widest hp:text-muted-foreground hp:group-focus/dropdown-menu-item:text-accent-foreground", className)}
	{...restProps}
>
	{@render children?.()}
</span>
