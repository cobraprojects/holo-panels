<script lang="ts">
	import { Separator as SeparatorPrimitive } from "bits-ui";
	import { cn } from "../../lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		"data-slot": dataSlot = "separator",
		...restProps
	}: SeparatorPrimitive.RootProps = $props();
</script>

<SeparatorPrimitive.Root
	bind:ref
	data-slot={dataSlot}
	class={cn(
		"hp:shrink-0 hp:bg-border hp:data-[orientation=horizontal]:h-px hp:data-[orientation=horizontal]:w-full hp:data-[orientation=vertical]:w-px",
		// this is different in shadcn/ui but self-stretch breaks things for us
		"data-[orientation=vertical]:h-full",
		className
	)}
	{...restProps}
/>
