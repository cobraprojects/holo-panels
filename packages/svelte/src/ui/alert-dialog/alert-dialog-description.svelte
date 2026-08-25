<script lang="ts">
	import { AlertDialog as AlertDialogPrimitive } from "bits-ui";
	import { cn } from "../../lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: AlertDialogPrimitive.DescriptionProps = $props();
</script>

<AlertDialogPrimitive.Description
	bind:ref
	data-slot="alert-dialog-description"
	class={cn("hp:text-sm hp:text-balance hp:text-muted-foreground hp:md:text-pretty hp:*:[a]:underline hp:*:[a]:underline-offset-3 hp:*:[a]:hover:text-foreground", className)}
	{...restProps}
/>
