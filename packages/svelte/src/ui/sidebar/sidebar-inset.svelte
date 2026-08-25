<script lang="ts">
	import { cn, type WithElementRef } from "../../lib/utils.js";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLElement>> = $props();
</script>

<main
	bind:this={ref}
	data-slot="sidebar-inset"
	class={cn("hp:bg-background hp:md:peer-data-[variant=inset]:m-2 hp:md:peer-data-[variant=inset]:ml-0 hp:md:peer-data-[variant=inset]:rounded-xl hp:md:peer-data-[variant=inset]:shadow-sm hp:md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-2 hp:relative hp:flex hp:w-full hp:flex-1 hp:flex-col", className)}
	{...restProps}
>
	{@render children?.()}
</main>
