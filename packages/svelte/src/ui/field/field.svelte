<script lang="ts" module>
	import { tv, type VariantProps } from "tailwind-variants";

	export const fieldVariants = tv({
		base: "hp:gap-2 hp:data-[invalid=true]:text-destructive hp:group/field hp:flex hp:w-full",
		variants: {
			orientation: {
				vertical: "hp:cn-field-orientation-vertical hp:flex-col hp:[&>*]:w-full hp:[&>.sr-only]:w-auto",
				horizontal:
					"hp:cn-field-orientation-horizontal hp:flex-row hp:items-center hp:has-[>[data-slot=field-content]]:items-start hp:[&>[data-slot=field-label]]:flex-auto hp:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
				responsive:
					"hp:cn-field-orientation-responsive hp:flex-col hp:@md/field-group:flex-row hp:@md/field-group:items-center hp:@md/field-group:has-[>[data-slot=field-content]]:items-start hp:[&>*]:w-full hp:@md/field-group:[&>*]:w-auto hp:[&>.sr-only]:w-auto hp:@md/field-group:[&>[data-slot=field-label]]:flex-auto hp:@md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
			},
		},
		defaultVariants: {
			orientation: "vertical",
		},
	});

	export type FieldOrientation = VariantProps<typeof fieldVariants>["orientation"];
</script>

<script lang="ts">
	import { cn, type WithElementRef } from "../../lib/utils.js";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: className,
		orientation = "vertical",
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
		orientation?: FieldOrientation;
	} = $props();
</script>

<div
	bind:this={ref}
	role="group"
	data-slot="field"
	data-orientation={orientation}
	class={cn(fieldVariants({ orientation }), className)}
	{...restProps}
>
	{@render children?.()}
</div>
