<script lang="ts">
	import { Select as SelectPrimitive } from "bits-ui";
	import { cn } from "../../lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: SelectPrimitive.GroupProps = $props();
</script>

<SelectPrimitive.Group
	bind:ref
	data-slot="select-group"
	class={cn("hp:scroll-my-1 hp:p-1", className)}
	{...restProps}
/>
