<script lang="ts">
	import { Tooltip as TooltipPrimitive } from "bits-ui";
	import { panelsPortalTarget } from "../../portal";

	let { to, ...restProps }: TooltipPrimitive.PortalProps = $props();
	const panelTarget = panelsPortalTarget();
	let target = $derived(to ?? panelTarget());
</script>

<TooltipPrimitive.Portal to={target} {...restProps} />
