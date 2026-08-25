<script lang="ts" module>
	import { type VariantProps, tv } from "tailwind-variants";

	export const alertVariants = tv({
		base: "hp:grid hp:gap-0.5 hp:rounded-lg hp:border hp:px-2.5 hp:py-2 hp:text-left hp:text-sm hp:has-data-[slot=alert-action]:relative hp:has-data-[slot=alert-action]:pr-18 hp:has-[>svg]:grid-cols-[auto_1fr] hp:has-[>svg]:gap-x-2 hp:*:[svg]:row-span-2 hp:*:[svg]:translate-y-0.5 hp:*:[svg]:text-current hp:*:[svg:not([class*='size-'])]:size-4 hp:group/alert hp:relative hp:w-full",
		variants: {
			variant: {
				default: "hp:bg-card hp:text-card-foreground",
				destructive: "hp:bg-card hp:text-destructive hp:*:data-[slot=alert-description]:text-destructive/90 hp:*:[svg]:text-current",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	});

	export type AlertVariant = VariantProps<typeof alertVariants>["variant"];
</script>

<script lang="ts">
	import { cn, type WithElementRef } from "../../lib/utils.js";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: className,
		variant = "default",
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
		variant?: AlertVariant;
	} = $props();
</script>

<div
	bind:this={ref}
	data-slot="alert"
	role="alert"
	class={cn(alertVariants({ variant }), className)}
	{...restProps}
>
	{@render children?.()}
</div>
