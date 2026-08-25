<script lang="ts">
	import { Separator } from "../separator/index.js";
	import { cn } from "../../lib/utils.js";
	import type { Separator as SeparatorPrimitive } from "bits-ui";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: SeparatorPrimitive.RootProps = $props();
</script>

<Separator
	bind:ref
	data-slot="select-separator"
	class={cn("hp:-mx-1 hp:my-1 hp:h-px hp:bg-border hp:pointer-events-none", className)}
	{...restProps}
/>
