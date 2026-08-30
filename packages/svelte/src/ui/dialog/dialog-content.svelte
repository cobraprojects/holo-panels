<script lang="ts">
	import { Dialog as DialogPrimitive } from "bits-ui";
	import XIcon from '@lucide/svelte/icons/x';
	import { Button } from "../button/index.js";
	import { cn, type WithoutChildrenOrChild } from "../../lib/utils.js";
	import * as Dialog from "./index.js";
	import DialogPortal from "./dialog-portal.svelte";
	import type { Snippet } from "svelte";
	import type { ComponentProps } from "svelte";

	let {
		ref = $bindable(null),
		class: className,
		closeLabel = 'Close',
		portalProps,
		children,
		showCloseButton = true,
		...restProps
	}: WithoutChildrenOrChild<DialogPrimitive.ContentProps> & {
		closeLabel?: string;
		portalProps?: WithoutChildrenOrChild<ComponentProps<typeof DialogPortal>>;
		children: Snippet;
		showCloseButton?: boolean;
	} = $props();
</script>

<DialogPortal {...portalProps}>
	<Dialog.Overlay />
	<DialogPrimitive.Content
		bind:ref
		data-slot="dialog-content"
		data-panels-component="modal"
		class={cn(
			"hp:grid hp:max-w-[calc(100%-2rem)] hp:gap-4 hp:rounded-xl hp:bg-popover hp:p-4 hp:text-sm hp:text-popover-foreground hp:ring-1 hp:ring-foreground/10 hp:duration-100 hp:sm:max-w-sm hp:data-open:animate-in hp:data-open:fade-in-0 hp:data-open:zoom-in-95 hp:data-closed:animate-out hp:data-closed:fade-out-0 hp:data-closed:zoom-out-95 hp:fixed hp:top-1/2 hp:left-1/2 hp:z-50 hp:w-full hp:-translate-x-1/2 hp:-translate-y-1/2 hp:outline-none",
			"hp-modal",
			className
		)}
		{...restProps}
	>
		{@render children?.()}
		{#if showCloseButton}
			<DialogPrimitive.Close data-slot="dialog-close">
				{#snippet child({ props })}
					<Button variant="ghost" class="hp:absolute hp:top-2 hp:end-2" size="icon-sm" {...props}>
						<XIcon  />
						<span class="hp:sr-only">{closeLabel}</span>
					</Button>
				{/snippet}
			</DialogPrimitive.Close>
		{/if}
	</DialogPrimitive.Content>
</DialogPortal>
