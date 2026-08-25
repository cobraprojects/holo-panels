<script lang="ts">
	import { Popover as PopoverPrimitive } from "bits-ui";
	import { panelsPortalTarget } from "../../portal";

	let { to, ...restProps }: PopoverPrimitive.PortalProps = $props();
	const panelTarget = panelsPortalTarget();
	let target = $derived(to ?? panelTarget());
</script>

<PopoverPrimitive.Portal to={target} {...restProps} />
