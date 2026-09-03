<script lang="ts" module>
	import { tv, type VariantProps } from "tailwind-variants";
	export const inputGroupAddonVariants = tv({
		base: "hp:h-auto hp:gap-2 hp:py-1.5 hp:text-sm hp:font-medium hp:text-muted-foreground hp:group-data-[disabled=true]/input-group:opacity-50 hp:[&>kbd]:rounded-[calc(var(--radius)-5px)] hp:[&>svg:not([class*='size-'])]:size-4 hp:flex hp:cursor-text hp:items-center hp:justify-center hp:select-none",
		variants: {
			align: {
				"inline-start": "hp:ps-2 hp:has-[>button]:ms-[-0.3rem] hp:has-[>kbd]:ms-[-0.15rem] hp:order-first",
				"inline-end": "hp:pe-2 hp:has-[>button]:me-[-0.3rem] hp:has-[>kbd]:me-[-0.15rem] hp:order-last",
				"block-start": "hp:px-2.5 hp:pt-2 hp:group-has-[>input]/input-group:pt-2 hp:[.border-b]:pb-2 hp:order-first hp:w-full hp:justify-start",
				"block-end": "hp:px-2.5 hp:pb-2 hp:group-has-[>input]/input-group:pb-2 hp:[.border-t]:pt-2 hp:order-last hp:w-full hp:justify-start",
			},
		},
		defaultVariants: {
			align: "inline-start",
		},
	});

	export type InputGroupAddonAlign = VariantProps<typeof inputGroupAddonVariants>["align"];
</script>

<script lang="ts">
	import { cn, type WithElementRef } from "../../lib/utils.js";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: className,
		children,
		align = "inline-start",
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
		align?: InputGroupAddonAlign;
	} = $props();
</script>

<div
	bind:this={ref}
	role="group"
	data-slot="input-group-addon"
	data-align={align}
	class={cn(inputGroupAddonVariants({ align }), className)}
	onclick={(e) => {
		if ((e.target as HTMLElement).closest("button")) {
			return;
		}
		e.currentTarget.parentElement?.querySelector("input")?.focus();
	}}
	{...restProps}
>
	{@render children?.()}
</div>
