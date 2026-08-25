<script lang="ts" module>
	import { tv, type VariantProps } from "tailwind-variants";

	export const tabsListVariants = tv({
		base: "hp:rounded-lg hp:p-[3px] hp:group-data-horizontal/tabs:h-8 hp:data-[variant=line]:rounded-none hp:group/tabs-list hp:inline-flex hp:w-fit hp:items-center hp:justify-center hp:text-muted-foreground hp:group-data-[orientation=vertical]/tabs:h-fit hp:group-data-[orientation=vertical]/tabs:flex-col",
		variants: {
			variant: {
				default: "hp:cn-tabs-list-variant-default hp:bg-muted",
				line: "hp:cn-tabs-list-variant-line hp:gap-1 hp:bg-transparent",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	});

	export type TabsListVariant = VariantProps<typeof tabsListVariants>["variant"];
</script>

<script lang="ts">
	import { Tabs as TabsPrimitive } from "bits-ui";
	import { cn } from "../../lib/utils.js";

	let {
		ref = $bindable(null),
		variant = "default",
		class: className,
		...restProps
	}: TabsPrimitive.ListProps & {
		variant?: TabsListVariant;
	} = $props();
</script>

<TabsPrimitive.List
	bind:ref
	data-slot="tabs-list"
	data-variant={variant}
	class={cn(tabsListVariants({ variant }), className)}
	{...restProps}
/>
