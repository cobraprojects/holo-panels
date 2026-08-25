<script lang="ts" module>
	import { tv, type VariantProps } from "tailwind-variants";

	export const sidebarMenuButtonVariants = tv({
		base: "hp:gap-2 hp:rounded-md hp:p-2 hp:text-left hp:text-sm hp:ring-sidebar-ring hp:transition-[width,height,padding] hp:group-has-data-[sidebar=menu-action]/menu-item:pr-8 hp:group-data-[collapsible=icon]:size-8! hp:group-data-[collapsible=icon]:p-2! hp:hover:bg-sidebar-accent hp:hover:text-sidebar-accent-foreground hp:focus-visible:ring-2 hp:active:bg-sidebar-accent hp:active:text-sidebar-accent-foreground hp:data-open:hover:bg-sidebar-accent hp:data-open:hover:text-sidebar-accent-foreground hp:data-active:bg-sidebar-accent hp:data-active:font-medium hp:data-active:text-sidebar-accent-foreground hp:peer/menu-button hp:group/menu-button hp:flex hp:w-full hp:items-center hp:overflow-hidden hp:outline-hidden hp:disabled:pointer-events-none hp:disabled:opacity-50 hp:aria-disabled:pointer-events-none hp:aria-disabled:opacity-50 hp:[&_svg]:size-4 hp:[&_svg]:shrink-0 hp:[&>span:last-child]:truncate",
		variants: {
			variant: {
				default: "hp:hover:bg-sidebar-accent hp:hover:text-sidebar-accent-foreground",
				outline: "hp:bg-background hp:shadow-[0_0_0_1px_var(--sidebar-border)] hp:hover:bg-sidebar-accent hp:hover:text-sidebar-accent-foreground hp:hover:shadow-[0_0_0_1px_var(--sidebar-accent)]",
			},
			size: {
				default: "hp:h-8 hp:text-sm",
				sm: "hp:h-7 hp:text-xs",
				lg: "hp:h-12 hp:text-sm hp:group-data-[collapsible=icon]:p-0!",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	});

	export type SidebarMenuButtonVariant = VariantProps<typeof sidebarMenuButtonVariants>["variant"];
	export type SidebarMenuButtonSize = VariantProps<typeof sidebarMenuButtonVariants>["size"];
</script>

<script lang="ts">
	import { mergeProps } from "bits-ui";
	import * as Tooltip from "../tooltip/index.js";
	import { cn, type WithElementRef, type WithoutChildrenOrChild } from "../../lib/utils.js";
	import { useSidebar } from "./context.svelte.js";
	import type { ComponentProps, Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: className,
		children,
		child,
		variant = "default",
		size = "default",
		isActive = false,
		tooltipContent,
		tooltipContentProps,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLButtonElement>, HTMLButtonElement> & {
		isActive?: boolean;
		variant?: SidebarMenuButtonVariant;
		size?: SidebarMenuButtonSize;
		tooltipContent?: Snippet | string;
		tooltipContentProps?: WithoutChildrenOrChild<ComponentProps<typeof Tooltip.Content>>;
		child?: Snippet<[{ props: Record<string, unknown> }]>;
	} = $props();

	const sidebar = useSidebar();

	const buttonProps = $derived({
		class: cn(sidebarMenuButtonVariants({ variant, size }), className),
		"data-slot": "sidebar-menu-button",
		"data-sidebar": "menu-button",
		"data-size": size,
		"data-active": isActive,
		...restProps,
	});
</script>

{#snippet Button({ props }: { props?: Record<string, unknown> })}
	{@const mergedProps = mergeProps(buttonProps, props)}
	{#if child}
		{@render child({ props: mergedProps })}
	{:else}
		<button bind:this={ref} {...mergedProps}>
			{@render children?.()}
		</button>
	{/if}
{/snippet}

{#if !tooltipContent}
	{@render Button({})}
{:else}
	<Tooltip.Root>
		<Tooltip.Trigger>
			{#snippet child({ props })}
				{@render Button({ props })}
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Content
			side="right"
			align="center"
			hidden={sidebar.state !== "collapsed" || sidebar.isMobile}
			{...tooltipContentProps}
		>
			{#if typeof tooltipContent === "string"}
				{tooltipContent}
			{:else if tooltipContent}
				{@render tooltipContent()}
			{/if}
		</Tooltip.Content>
	</Tooltip.Root>
{/if}
