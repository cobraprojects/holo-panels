<script lang="ts" module>
	import { tv, type VariantProps } from "tailwind-variants";

	const inputGroupButtonVariants = tv({
		base: "hp:gap-2 hp:text-sm hp:flex hp:items-center hp:shadow-none",
		variants: {
			size: {
				xs: "hp:h-6 hp:gap-1 hp:rounded-[calc(var(--radius)-3px)] hp:px-1.5 hp:[&>svg:not([class*='size-'])]:size-3.5",
				sm: "hp:cn-input-group-button-size-sm",
				"icon-xs": "hp:size-6 hp:rounded-[calc(var(--radius)-3px)] hp:p-0 hp:has-[>svg]:p-0",
				"icon-sm": "hp:size-8 hp:p-0 hp:has-[>svg]:p-0",
			},
		},
		defaultVariants: {
			size: "xs",
		},
	});

	export type InputGroupButtonSize = VariantProps<typeof inputGroupButtonVariants>["size"];
</script>

<script lang="ts">
	import { Button } from "../button/index.js";
	import { cn } from "../../lib/utils.js";
	import type { ComponentProps } from "svelte";

	let {
		ref = $bindable(null),
		class: className,
		children,
		type = "button",
		variant = "ghost",
		size = "xs",
		...restProps
	}: Omit<ComponentProps<typeof Button>, "href" | "size"> & {
		size?: InputGroupButtonSize;
	} = $props();
</script>

<Button
	bind:ref
	{type}
	data-size={size}
	{variant}
	class={cn(inputGroupButtonVariants({ size }), className)}
	{...restProps}
>
	{@render children?.()}
</Button>
