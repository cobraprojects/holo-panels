<script lang="ts">
	import { Label as LabelPrimitive } from "bits-ui";
	import { cn } from "../../lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: LabelPrimitive.RootProps = $props();
</script>

<LabelPrimitive.Root
	bind:ref
	data-slot="label"
	class={cn(
		"hp:gap-2 hp:text-sm hp:leading-none hp:font-medium hp:group-data-[disabled=true]:opacity-50 hp:peer-disabled:opacity-50 hp:flex hp:items-center hp:select-none hp:group-data-[disabled=true]:pointer-events-none hp:peer-disabled:cursor-not-allowed",
		className
	)}
	{...restProps}
/>
