<script lang="ts">
	import { Tooltip as TooltipPrimitive } from "bits-ui";
	import { cn } from "../../lib/utils.js";
	import type { WithoutChildrenOrChild } from "../../lib/utils.js";
	import TooltipPortal from "./tooltip-portal.svelte";
	import type { ComponentProps } from "svelte";

	let {
		ref = $bindable(null),
		class: className,
		sideOffset = 0,
		side = "top",
		children,
		arrowClasses,
		portalProps,
		...restProps
	}: TooltipPrimitive.ContentProps & {
		arrowClasses?: string;
		portalProps?: WithoutChildrenOrChild<ComponentProps<typeof TooltipPortal>>;
	} = $props();
</script>

<TooltipPortal {...portalProps}>
	<TooltipPrimitive.Content
		bind:ref
		data-slot="tooltip-content"
		{sideOffset}
		{side}
		class={cn(
			"hp:inline-flex hp:items-center hp:gap-1.5 hp:rounded-md hp:px-3 hp:py-1.5 hp:text-xs hp:has-data-[slot=kbd]:pr-1.5 hp:data-[side=bottom]:slide-in-from-top-2 hp:data-[side=left]:slide-in-from-right-2 hp:data-[side=right]:slide-in-from-left-2 hp:data-[side=top]:slide-in-from-bottom-2 hp:**:data-[slot=kbd]:relative hp:**:data-[slot=kbd]:isolate hp:**:data-[slot=kbd]:z-50 hp:**:data-[slot=kbd]:rounded-sm hp:data-[state=delayed-open]:animate-in hp:data-[state=delayed-open]:fade-in-0 hp:data-[state=delayed-open]:zoom-in-95 hp:data-open:animate-in hp:data-open:fade-in-0 hp:data-open:zoom-in-95 hp:data-closed:animate-out hp:data-closed:fade-out-0 hp:data-closed:zoom-out-95 hp:z-50 hp:w-fit hp:max-w-xs hp:origin-(--bits-tooltip-content-transform-origin) hp:bg-foreground hp:text-background",
			className
		)}
		{...restProps}
	>
		{@render children?.()}
		<TooltipPrimitive.Arrow>
			{#snippet child({ props })}
				<div
					class={cn(
						"hp:size-2.5 hp:translate-y-[calc(-50%-2px)] hp:rotate-45 hp:rounded-[2px] hp:z-50 hp:bg-foreground hp:fill-foreground",
						"hp:data-[side=top]:translate-x-1/2 hp:data-[side=top]:translate-y-[calc(-50%+2px)]",
						"hp:data-[side=bottom]:-translate-x-1/2 hp:data-[side=bottom]:-translate-y-[calc(-50%+1px)]",
						"hp:data-[side=right]:translate-x-[calc(50%+2px)] hp:data-[side=right]:translate-y-1/2",
						"data-[side=left]:-translate-y-[calc(50%-3px)]",
						arrowClasses
					)}
					{...props}
				></div>
			{/snippet}
		</TooltipPrimitive.Arrow>
	</TooltipPrimitive.Content>
</TooltipPortal>
