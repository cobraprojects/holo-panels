<script lang="ts" module>
	import { type VariantProps, tv } from "tailwind-variants";

	export const badgeVariants = tv({
		base: "hp:h-5 hp:gap-1 hp:rounded-4xl hp:border hp:border-transparent hp:px-2 hp:py-0.5 hp:text-xs hp:font-medium hp:transition-all hp:has-data-[icon=inline-end]:pr-1.5 hp:has-data-[icon=inline-start]:pl-1.5 hp:[&>svg]:size-3! hp:group/badge hp:inline-flex hp:w-fit hp:shrink-0 hp:items-center hp:justify-center hp:overflow-hidden hp:whitespace-nowrap hp:transition-colors hp:focus-visible:border-ring hp:focus-visible:ring-[3px] hp:focus-visible:ring-ring/50 hp:aria-invalid:border-destructive hp:aria-invalid:ring-destructive/20 hp:dark:aria-invalid:ring-destructive/40 hp:[&>svg]:pointer-events-none",
		variants: {
			variant: {
				default: "hp:bg-primary hp:text-primary-foreground hp:[a]:hover:bg-primary/80",
				secondary: "hp:bg-secondary hp:text-secondary-foreground hp:[a]:hover:bg-secondary/80",
				destructive: "hp:bg-destructive/10 hp:text-destructive hp:focus-visible:ring-destructive/20 hp:dark:bg-destructive/20 hp:dark:focus-visible:ring-destructive/40 hp:[a]:hover:bg-destructive/20",
				outline: "hp:border-border hp:text-foreground hp:[a]:hover:bg-muted hp:[a]:hover:text-muted-foreground",
				ghost: "hp:hover:bg-muted hp:hover:text-muted-foreground hp:dark:hover:bg-muted/50",
				link: "hp:text-primary hp:underline-offset-4 hp:hover:underline",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	});

	export type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];
</script>

<script lang="ts">
	import { cn, type WithElementRef } from "../../lib/utils.js";
	import type { HTMLAnchorAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		href,
		class: className,
		variant = "default",
		children,
		...restProps
	}: WithElementRef<HTMLAnchorAttributes> & {
		variant?: BadgeVariant;
	} = $props();
</script>

<svelte:element
	this={href ? "a" : "span"}
	bind:this={ref}
	data-slot="badge"
	data-variant={variant}
	{href}
	class={cn(badgeVariants({ variant }), className)}
	{...restProps}
>
	{@render children?.()}
</svelte:element>
