<script lang="ts" module>
	import { type VariantProps, tv } from "tailwind-variants";
	import { cn, type WithElementRef } from "../../lib/utils.js";
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from "svelte/elements";

	export const buttonVariants = tv({
		base: "hp:rounded-lg hp:border hp:border-transparent hp:bg-clip-padding hp:text-sm hp:font-medium hp:focus-visible:border-ring hp:focus-visible:ring-3 hp:focus-visible:ring-ring/50 hp:active:not-aria-[haspopup]:translate-y-px hp:aria-invalid:border-destructive hp:aria-invalid:ring-3 hp:aria-invalid:ring-destructive/20 hp:dark:aria-invalid:border-destructive/50 hp:dark:aria-invalid:ring-destructive/40 hp:[&_svg:not([class*='size-'])]:size-4 hp:group/button hp:inline-flex hp:shrink-0 hp:items-center hp:justify-center hp:whitespace-nowrap hp:transition-all hp:outline-none hp:select-none hp:disabled:pointer-events-none hp:disabled:opacity-50 hp:[&_svg]:pointer-events-none hp:[&_svg]:shrink-0",
		variants: {
			variant: {
				default: "hp:bg-primary hp:text-primary-foreground hp:[a]:hover:bg-primary/80",
				outline: "hp:border-border hp:bg-background hp:hover:bg-muted hp:hover:text-foreground hp:aria-expanded:bg-muted hp:aria-expanded:text-foreground hp:dark:border-input hp:dark:bg-input/30 hp:dark:hover:bg-input/50",
				secondary: "hp:bg-secondary hp:text-secondary-foreground hp:hover:bg-secondary/80 hp:aria-expanded:bg-secondary hp:aria-expanded:text-secondary-foreground",
				ghost: "hp:hover:bg-muted hp:hover:text-foreground hp:aria-expanded:bg-muted hp:aria-expanded:text-foreground hp:dark:hover:bg-muted/50",
				destructive: "hp:bg-destructive/10 hp:text-destructive hp:hover:bg-destructive/20 hp:focus-visible:border-destructive/40 hp:focus-visible:ring-destructive/20 hp:dark:bg-destructive/20 hp:dark:hover:bg-destructive/30 hp:dark:focus-visible:ring-destructive/40",
				link: "hp:text-primary hp:underline-offset-4 hp:hover:underline",
			},
			size: {
				default: "hp:h-8 hp:gap-1.5 hp:px-2.5 hp:has-data-[icon=inline-end]:pr-2 hp:has-data-[icon=inline-start]:pl-2",
				xs: "hp:h-6 hp:gap-1 hp:rounded-[min(var(--radius-md),10px)] hp:px-2 hp:text-xs hp:in-data-[slot=button-group]:rounded-lg hp:has-data-[icon=inline-end]:pr-1.5 hp:has-data-[icon=inline-start]:pl-1.5 hp:[&_svg:not([class*='size-'])]:size-3",
				sm: "hp:h-7 hp:gap-1 hp:rounded-[min(var(--radius-md),12px)] hp:px-2.5 hp:text-[0.8rem] hp:in-data-[slot=button-group]:rounded-lg hp:has-data-[icon=inline-end]:pr-1.5 hp:has-data-[icon=inline-start]:pl-1.5 hp:[&_svg:not([class*='size-'])]:size-3.5",
				lg: "hp:h-9 hp:gap-1.5 hp:px-2.5 hp:has-data-[icon=inline-end]:pr-2 hp:has-data-[icon=inline-start]:pl-2",
				icon: "hp:size-8",
				"icon-xs": "hp:size-6 hp:rounded-[min(var(--radius-md),10px)] hp:in-data-[slot=button-group]:rounded-lg hp:[&_svg:not([class*='size-'])]:size-3",
				"icon-sm": "hp:size-7 hp:rounded-[min(var(--radius-md),12px)] hp:in-data-[slot=button-group]:rounded-lg",
				"icon-lg": "hp:size-9",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	});

	export type ButtonVariant = VariantProps<typeof buttonVariants>["variant"];
	export type ButtonSize = VariantProps<typeof buttonVariants>["size"];

	export type ButtonProps = WithElementRef<HTMLButtonAttributes> &
		WithElementRef<HTMLAnchorAttributes> & {
			variant?: ButtonVariant;
			size?: ButtonSize;
		};
</script>

<script lang="ts">
	let {
		class: className,
		variant = "default",
		size = "default",
		ref = $bindable(null),
		href = undefined,
		type = "button",
		disabled,
		children,
		...restProps
	}: ButtonProps = $props();
</script>

{#if href}
	<a
		bind:this={ref}
		data-slot="button"
		data-variant={variant}
		data-size={size}
		class={cn(buttonVariants({ variant, size }), className)}
		href={disabled ? undefined : href}
		aria-disabled={disabled}
		role={disabled ? "link" : undefined}
		tabindex={disabled ? -1 : undefined}
		{...restProps}
	>
		{@render children?.()}
	</a>
{:else}
	<button
		bind:this={ref}
		data-slot="button"
		data-variant={variant}
		data-size={size}
		class={cn(buttonVariants({ variant, size }), className)}
		{type}
		{disabled}
		{...restProps}
	>
		{@render children?.()}
	</button>
{/if}
