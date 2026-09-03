<script lang="ts">
	import { cn, type WithElementRef } from "../../lib/utils.js";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...props
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();
</script>

<div
	bind:this={ref}
	data-slot="input-group"
	role="group"
	class={cn(
		"hp:group/input-group hp:h-9 hp:rounded-md hp:border hp:border-input hp:transition-colors hp:in-data-[slot=combobox-content]:focus-within:border-inherit hp:in-data-[slot=combobox-content]:focus-within:ring-0 hp:has-disabled:bg-input/50 hp:has-disabled:opacity-50 hp:has-[[data-slot=input-group-control]:focus-visible]:border-ring hp:has-[[data-slot=input-group-control]:focus-visible]:ring-3 hp:has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50 hp:has-[[data-slot][aria-invalid=true]]:border-destructive hp:has-[[data-slot][aria-invalid=true]]:ring-3 hp:has-[[data-slot][aria-invalid=true]]:ring-destructive/20 hp:has-[>[data-align=block-end]]:h-auto hp:has-[>[data-align=block-end]]:flex-col hp:has-[>[data-align=block-start]]:h-auto hp:has-[>[data-align=block-start]]:flex-col hp:dark:bg-input/30 hp:dark:has-disabled:bg-input/80 hp:dark:has-[[data-slot][aria-invalid=true]]:ring-destructive/40 hp:has-[>[data-align=block-end]]:[&>input]:pt-3 hp:has-[>[data-align=block-start]]:[&>input]:pb-3 hp:has-[>[data-align=inline-end]]:[&>input]:pe-1.5 hp:has-[>[data-align=inline-start]]:[&>input]:ps-1.5 hp:relative hp:flex hp:w-full hp:min-w-0 hp:items-center hp:outline-none hp:has-[>textarea]:h-auto",
		className
	)}
	{...props}
>
	{@render children?.()}
</div>
