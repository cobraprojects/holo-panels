<script lang="ts" module>
	export type Side = "top" | "right" | "bottom" | "left";
</script>

<script lang="ts">
	import { Dialog as SheetPrimitive } from "bits-ui";
	import XIcon from '@lucide/svelte/icons/x';
	import { Button } from "../button/index.js";
	import { cn, type WithoutChildrenOrChild } from "../../lib/utils.js";
	import SheetOverlay from "./sheet-overlay.svelte";
	import SheetPortal from "./sheet-portal.svelte";
	import type { Snippet } from "svelte";
	import type { ComponentProps } from "svelte";

	let {
		ref = $bindable(null),
		class: className,
		closeLabel = 'Close',
		side = "right",
		showCloseButton = true,
		portalProps,
		children,
		...restProps
	}: WithoutChildrenOrChild<SheetPrimitive.ContentProps> & {
		closeLabel?: string;
		portalProps?: WithoutChildrenOrChild<ComponentProps<typeof SheetPortal>>;
		side?: Side;
		showCloseButton?: boolean;
		children: Snippet;
	} = $props();
</script>

<SheetPortal {...portalProps}>
	<SheetOverlay />
	<SheetPrimitive.Content
		bind:ref
		data-slot="sheet-content"
		data-panels-component="slide-over"
		data-side={side}
		class={cn(
			"hp:fixed hp:z-50 hp:flex hp:flex-col hp:gap-4 hp:bg-popover hp:bg-clip-padding hp:text-sm hp:text-popover-foreground hp:shadow-lg hp:transition hp:duration-200 hp:ease-in-out hp:data-[side=bottom]:inset-x-0 hp:data-[side=bottom]:bottom-0 hp:data-[side=bottom]:h-auto hp:data-[side=bottom]:border-t hp:data-[side=left]:inset-y-0 hp:data-[side=left]:left-0 hp:data-[side=left]:h-full hp:data-[side=left]:w-3/4 hp:data-[side=left]:border-r hp:data-[side=right]:inset-y-0 hp:data-[side=right]:right-0 hp:data-[side=right]:h-full hp:data-[side=right]:w-3/4 hp:data-[side=right]:border-l hp:data-[side=top]:inset-x-0 hp:data-[side=top]:top-0 hp:data-[side=top]:h-auto hp:data-[side=top]:border-b hp:data-[side=left]:sm:max-w-sm hp:data-[side=right]:sm:max-w-sm hp:data-[state=open]:animate-in hp:data-[state=open]:fade-in-0 hp:data-[side=bottom]:data-[state=open]:slide-in-from-bottom-10 hp:data-[side=left]:data-[state=open]:slide-in-from-left-10 hp:data-[side=right]:data-[state=open]:slide-in-from-right-10 hp:data-[side=top]:data-[state=open]:slide-in-from-top-10 hp:data-[state=closed]:animate-out hp:data-[state=closed]:fade-out-0 hp:data-[side=bottom]:data-[state=closed]:slide-out-to-bottom-10 hp:data-[side=left]:data-[state=closed]:slide-out-to-left-10 hp:data-[side=right]:data-[state=closed]:slide-out-to-right-10 hp:data-[side=top]:data-[state=closed]:slide-out-to-top-10",
			"hp-slide-over",
			className
		)}
		{...restProps}
	>
		{@render children?.()}
		{#if showCloseButton}
			<SheetPrimitive.Close data-slot="sheet-close">
				{#snippet child({ props })}
					<Button variant="ghost" class="hp:absolute hp:top-3 hp:end-3" size="icon-sm" {...props}>
						<XIcon  />
						<span class="hp:sr-only">{closeLabel}</span>
					</Button>
				{/snippet}
			</SheetPrimitive.Close>
		{/if}
	</SheetPrimitive.Content>
</SheetPortal>
