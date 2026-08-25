<script lang="ts">
	import { Dialog as DialogPrimitive } from "bits-ui";
	import { cn } from "../../lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: DialogPrimitive.DescriptionProps = $props();
</script>

<DialogPrimitive.Description
	bind:ref
	data-slot="dialog-description"
	class={cn("hp:text-sm hp:text-muted-foreground hp:*:[a]:underline hp:*:[a]:underline-offset-3 hp:*:[a]:hover:text-foreground", className)}
	{...restProps}
/>
