<script lang="ts" module>
	import { tv, type VariantProps } from "tailwind-variants";

	export const emptyMediaVariants = tv({
		base: "hp:mb-2 hp:flex hp:shrink-0 hp:items-center hp:justify-center hp:[&_svg]:pointer-events-none hp:[&_svg]:shrink-0",
		variants: {
			variant: {
				default: "hp:bg-transparent",
				icon: "hp:flex hp:size-8 hp:shrink-0 hp:items-center hp:justify-center hp:rounded-lg hp:bg-muted hp:text-foreground hp:[&_svg:not([class*='size-'])]:size-4",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	});

	export type EmptyMediaVariant = VariantProps<typeof emptyMediaVariants>["variant"];
</script>

<script lang="ts">
	import { cn, type WithElementRef } from "../../lib/utils.js";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: className,
		children,
		variant = "default",
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & { variant?: EmptyMediaVariant } = $props();
</script>

<div
	bind:this={ref}
	data-slot="empty-icon"
	data-variant={variant}
	class={cn(emptyMediaVariants({ variant }), className)}
	{...restProps}
>
	{@render children?.()}
</div>
