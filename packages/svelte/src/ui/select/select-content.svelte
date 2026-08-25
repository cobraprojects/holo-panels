<script lang="ts">
	import { Select as SelectPrimitive } from "bits-ui";
	import { cn, type WithoutChild } from "../../lib/utils.js";
	import type { WithoutChildrenOrChild } from "../../lib/utils.js";
	import SelectPortal from "./select-portal.svelte";
	import SelectScrollDownButton from "./select-scroll-down-button.svelte";
	import SelectScrollUpButton from "./select-scroll-up-button.svelte";
	import type { ComponentProps } from "svelte";

	let {
		ref = $bindable(null),
		class: className,
		sideOffset = 4,
		portalProps,
		children,
		preventScroll = true,
		...restProps
	}: WithoutChild<SelectPrimitive.ContentProps> & {
		portalProps?: WithoutChildrenOrChild<ComponentProps<typeof SelectPortal>>;
	} = $props();
</script>

<SelectPortal {...portalProps}>
	<SelectPrimitive.Content
		bind:ref
		{sideOffset}
		{preventScroll}
		data-slot="select-content"
		class={cn(
			"hp:min-w-36 hp:rounded-lg hp:bg-popover hp:text-popover-foreground hp:shadow-md hp:ring-1 hp:ring-foreground/10 hp:duration-100 hp:data-[side=bottom]:slide-in-from-top-2 hp:data-[side=left]:slide-in-from-right-2 hp:data-[side=right]:slide-in-from-left-2 hp:data-[side=top]:slide-in-from-bottom-2 hp:data-open:animate-in hp:data-open:fade-in-0 hp:data-open:zoom-in-95 hp:data-closed:animate-out hp:data-closed:fade-out-0 hp:data-closed:zoom-out-95 hp:data-[side=inline-end]:slide-in-from-left-2 hp:data-[side=inline-start]:slide-in-from-right-2 hp:relative hp:isolate hp:z-50 hp:overflow-x-hidden hp:overflow-y-auto",
			className
		)}
		{...restProps}
	>
		<SelectScrollUpButton />
		<SelectPrimitive.Viewport
			class={cn(
				"hp:h-(--bits-select-anchor-height) hp:w-full hp:min-w-(--bits-select-anchor-width) hp:scroll-my-1"
			)}
		>
			{@render children?.()}
		</SelectPrimitive.Viewport>
		<SelectScrollDownButton />
	</SelectPrimitive.Content>
</SelectPortal>
