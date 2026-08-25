<script lang="ts">
	import { mode } from "mode-watcher";
	import { Toaster as Sonner, type ToasterProps as SonnerProps } from "svelte-sonner";
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
	import OctagonXIcon from '@lucide/svelte/icons/octagon-x';
	import InfoIcon from '@lucide/svelte/icons/info';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';

	let { ...restProps }: SonnerProps = $props();
</script>

<Sonner
	theme={mode.current}
	class="hp:toaster hp:group"
	style="hp:--normal-bg: hp:var(--color-popover); hp:--normal-text: hp:var(--color-popover-foreground); hp:--normal-border: hp:var(--color-border);"
	{...restProps}
>
	{#snippet loadingIcon()}
		<Loader2Icon class="hp:size-4 hp:animate-spin" />
	{/snippet}
	{#snippet successIcon()}
		<CircleCheckIcon class="hp:size-4" />
	{/snippet}
	{#snippet errorIcon()}
		<OctagonXIcon class="hp:size-4" />
	{/snippet}
	{#snippet infoIcon()}
		<InfoIcon class="hp:size-4" />
	{/snippet}
	{#snippet warningIcon()}
		<TriangleAlertIcon class="hp:size-4" />
	{/snippet}
</Sonner>
